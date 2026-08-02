import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

import { resolveHttpAuditPriority } from '../auditPriority';
import { verifyFirebaseIdToken } from '../verifyFirebaseIdToken';

const mockVerify = vi.mocked(verifyFirebaseIdToken);

function makeRequest(token: string | null): Request {
  return new Request('https://example.com/api/audit', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('resolveHttpAuditPriority', () => {
  it('resolves admin for the verified admin email', async () => {
    mockVerify.mockResolvedValue({ uid: 'dean-uid', email: 'deanburt1308@gmail.com' });
    const priority = await resolveHttpAuditPriority(makeRequest('valid-admin-token'), 'test-project');
    expect(priority).toBe('admin');
  });

  it('resolves customer for a verified non-admin user', async () => {
    mockVerify.mockResolvedValue({ uid: 'some-uid', email: 'pro-user@example.com' });
    const priority = await resolveHttpAuditPriority(makeRequest('valid-customer-token'), 'test-project');
    expect(priority).toBe('customer');
  });

  it('resolves customer for a free-plan verified user identically to a Pro user (budget priority does not distinguish billing plan)', async () => {
    mockVerify.mockResolvedValue({ uid: 'free-uid', email: 'free-user@example.com' });
    const priority = await resolveHttpAuditPriority(makeRequest('valid-free-token'), 'test-project');
    expect(priority).toBe('customer');
  });

  it('resolves public when there is no Authorization header at all', async () => {
    const priority = await resolveHttpAuditPriority(makeRequest(null), 'test-project');
    expect(priority).toBe('public');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('resolves public when the token fails verification (expired/malformed/wrong project)', async () => {
    mockVerify.mockResolvedValue(null);
    const priority = await resolveHttpAuditPriority(makeRequest('garbage-or-expired-token'), 'test-project');
    expect(priority).toBe('public');
  });

  it('CRITICAL: a spoofed admin email in a forged/unverifiable token is rejected — verifyFirebaseIdToken itself is the only source of truth, never the raw token content', async () => {
    // Simulates an attacker crafting a token whose payload merely CLAIMS the admin email but
    // doesn't pass real signature verification — verifyFirebaseIdToken must return null for
    // this to be safe, and resolveHttpAuditPriority must never look at the token's claims
    // itself. Since it only ever calls verifyFirebaseIdToken and trusts ITS return value, this
    // test documents that contract even though the "forging" happens inside the mock here.
    mockVerify.mockResolvedValue(null);
    const priority = await resolveHttpAuditPriority(makeRequest('forged-token-claiming-admin-email'), 'test-project');
    expect(priority).toBe('public');
  });

  it('resolves public when PUBLIC_FIREBASE_PROJECT_ID is not configured, regardless of token', async () => {
    const priority = await resolveHttpAuditPriority(makeRequest('some-token'), undefined);
    expect(priority).toBe('public');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('never reads a client-supplied priority field from the request body — no such parameter exists in the function signature', () => {
    // Structural guarantee: resolveHttpAuditPriority(request, projectId) has no third
    // parameter for a client-asserted priority/purpose. This test exists so any future edit
    // that adds one gets caught by a deliberate, obvious test failure/type error.
    expect(resolveHttpAuditPriority.length).toBe(2);
  });
});
