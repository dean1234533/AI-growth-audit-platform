import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../firestore')>();
  return {
    ...actual,
    getFirestoreDocument: vi.fn(),
    updateFirestoreDocument: vi.fn(),
  };
});

import {
  hasRenderBudget,
  recordRenderUsage,
  recordBudgetSkip,
  TOTAL_SAFE_DAILY_BUDGET_SECONDS,
  PROTECTED_CUSTOMER_RESERVATION_SECONDS,
  PUBLIC_ALLOCATION_SECONDS,
} from '../scanBudget';
import { getFirestoreDocument, updateFirestoreDocument, type ServiceAccount } from '../firestore';

const mockGetDoc = vi.mocked(getFirestoreDocument);
const mockUpdateDoc = vi.mocked(updateFirestoreDocument);

const fakeServiceAccount = { client_email: 'sa@test', private_key: 'key', project_id: 'test' } as unknown as ServiceAccount;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('hasRenderBudget — priority gating', () => {
  it('admin always allowed, even with zero service account (no Firestore needed)', async () => {
    const result = await hasRenderBudget(null, 'admin');
    expect(result.allowed).toBe(true);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('admin allowed even when secondsUsed is already at the total cap', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: TOTAL_SAFE_DAILY_BUDGET_SECONDS + 100 });
    const result = await hasRenderBudget(fakeServiceAccount, 'admin');
    expect(result.allowed).toBe(true);
  });

  it('customer allowed up to (and only up to) the full total budget, including the reserved band', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: TOTAL_SAFE_DAILY_BUDGET_SECONDS - PROTECTED_CUSTOMER_RESERVATION_SECONDS + 10 });
    const result = await hasRenderBudget(fakeServiceAccount, 'customer');
    expect(result.allowed).toBe(true); // still inside the reserved band — customer is allowed to use it
  });

  it('customer blocked only once the FULL total budget (540s) is exhausted', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: TOTAL_SAFE_DAILY_BUDGET_SECONDS });
    const result = await hasRenderBudget(fakeServiceAccount, 'customer');
    expect(result).toEqual({ allowed: false, reason: 'exhausted' });
  });

  it('monitoring cannot consume the protected customer reservation', async () => {
    const nonReservedCeiling = TOTAL_SAFE_DAILY_BUDGET_SECONDS - PROTECTED_CUSTOMER_RESERVATION_SECONDS;
    mockGetDoc.mockResolvedValue({ secondsUsed: nonReservedCeiling });
    const result = await hasRenderBudget(fakeServiceAccount, 'monitoring');
    expect(result).toEqual({ allowed: false, reason: 'reserved_for_customers' });
  });

  it('monitoring allowed while usage is still below the non-reserved ceiling', async () => {
    const nonReservedCeiling = TOTAL_SAFE_DAILY_BUDGET_SECONDS - PROTECTED_CUSTOMER_RESERVATION_SECONDS;
    mockGetDoc.mockResolvedValue({ secondsUsed: nonReservedCeiling - 10 });
    const result = await hasRenderBudget(fakeServiceAccount, 'monitoring');
    expect(result.allowed).toBe(true);
  });

  it('public allowed within its own small allocation and below the non-reserved ceiling', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: 10, publicSecondsUsed: 5 });
    const result = await hasRenderBudget(fakeServiceAccount, 'public');
    expect(result.allowed).toBe(true);
  });

  it('public blocked once its own allocation is exhausted, even if overall budget has room', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: 10, publicSecondsUsed: PUBLIC_ALLOCATION_SECONDS });
    const result = await hasRenderBudget(fakeServiceAccount, 'public');
    expect(result).toEqual({ allowed: false, reason: 'public_allocation_exhausted' });
  });

  it('public blocked once the non-reserved ceiling is hit, even if its own allocation has room', async () => {
    const nonReservedCeiling = TOTAL_SAFE_DAILY_BUDGET_SECONDS - PROTECTED_CUSTOMER_RESERVATION_SECONDS;
    mockGetDoc.mockResolvedValue({ secondsUsed: nonReservedCeiling, publicSecondsUsed: 1 });
    const result = await hasRenderBudget(fakeServiceAccount, 'public');
    expect(result).toEqual({ allowed: false, reason: 'reserved_for_customers' });
  });

  it('fails closed (no budget) when Firestore read throws, for every non-admin priority', async () => {
    mockGetDoc.mockRejectedValue(new Error('Firestore down'));
    for (const priority of ['customer', 'monitoring', 'public'] as const) {
      const result = await hasRenderBudget(fakeServiceAccount, priority);
      expect(result).toEqual({ allowed: false, reason: 'budget_unknown' });
    }
  });

  it('fails closed when no service account is configured at all (non-admin)', async () => {
    const result = await hasRenderBudget(null, 'customer');
    expect(result).toEqual({ allowed: false, reason: 'budget_unknown' });
  });
});

describe('recordRenderUsage', () => {
  it('accumulates secondsUsed and records a per-priority rendered count', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: 10, counts: {} });
    await recordRenderUsage(fakeServiceAccount, 5000, 'customer', 'rendered');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [, , , payload] = mockUpdateDoc.mock.calls[0];
    expect((payload as any).secondsUsed).toBe(15);
    expect((payload as any).counts.rendered.customer).toBe(1);
  });

  it('only increments publicSecondsUsed for priority "public"', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: 0, publicSecondsUsed: 0, counts: {} });
    await recordRenderUsage(fakeServiceAccount, 3000, 'monitoring', 'rendered');
    const [, , , payload] = mockUpdateDoc.mock.calls[0];
    expect((payload as any).publicSecondsUsed).toBe(0);

    mockGetDoc.mockResolvedValue({ secondsUsed: 3, publicSecondsUsed: 0, counts: {} });
    await recordRenderUsage(fakeServiceAccount, 2000, 'public', 'static_fallback');
    const [, , , payload2] = mockUpdateDoc.mock.calls[1];
    expect((payload2 as any).publicSecondsUsed).toBe(2);
    expect((payload2 as any).counts.staticFallback.public).toBe(1);
  });

  it('does nothing when no service account is configured', async () => {
    await recordRenderUsage(null, 5000, 'customer', 'rendered');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('never throws even if the Firestore write fails', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: 0 });
    mockUpdateDoc.mockRejectedValue(new Error('write failed'));
    await expect(recordRenderUsage(fakeServiceAccount, 1000, 'customer', 'rendered')).resolves.toBeUndefined();
  });
});

describe('recordBudgetSkip', () => {
  it('records a skip count by priority and a human-readable last-skip reason, without touching secondsUsed', async () => {
    mockGetDoc.mockResolvedValue({ secondsUsed: 400, counts: {} });
    await recordBudgetSkip(fakeServiceAccount, 'monitoring', 'reserved_for_customers');
    const [, , , payload] = mockUpdateDoc.mock.calls[0];
    expect((payload as any).counts.skipped.monitoring).toBe(1);
    expect((payload as any).lastSkipReason).toContain('monitoring');
    expect((payload as any).secondsUsed).toBeUndefined();
  });
});
