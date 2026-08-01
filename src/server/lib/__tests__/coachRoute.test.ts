import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  env: { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'sa@test', private_key: 'key', project_id: 'test-project' }) },
}));

vi.mock('../verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

vi.mock('../firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../firestore')>();
  return {
    ...actual,
    getFirestoreDocument: vi.fn(),
  };
});

vi.mock('../gemini', () => ({
  getStoredGeminiKey: vi.fn(),
  createGeminiRunner: vi.fn(() => ({ run: vi.fn().mockResolvedValue({ response: 'gemini answer' }) })),
}));

import { POST } from '../../../pages/api/coach';
import { verifyFirebaseIdToken } from '../verifyFirebaseIdToken';
import { getFirestoreDocument } from '../firestore';
import { getStoredGeminiKey, createGeminiRunner } from '../gemini';

const mockVerify = vi.mocked(verifyFirebaseIdToken);
const mockGetDoc = vi.mocked(getFirestoreDocument);
const mockGetStoredGeminiKey = vi.mocked(getStoredGeminiKey);
const mockCreateGeminiRunner = vi.mocked(createGeminiRunner);

const sampleAudit = {
  url: 'https://example.com',
  scannedAt: '2026-08-01T00:00:00Z',
  overallScore: 80,
  categories: [{ id: 'seo', label: 'SEO', score: 80, checks: [] }],
  recommendations: [],
  growthEstimate: { additionalEnquiriesPerMonth: [0, 1], visibilityImprovementPct: 0, conversionImprovementPct: 0, speedImprovementPct: 0, accessibilityImprovementPct: 0 },
  meta: { pageTitle: 't', partial: false, warnings: [] },
};

function makeRequest(body: unknown, token: string | null): Request {
  return new Request('https://example.com/api/coach', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

// The Cloudflare Workers AI binding isn't reachable from plain vitest, so we don't have a real
// `env.AI` to fall back to here — tests that get past the entitlement check and have no Gemini
// key configured 503 at the "no AI runner available" stage, same as before this change.
beforeEach(() => {
  vi.stubEnv('PUBLIC_FIREBASE_PROJECT_ID', 'test-project');
  mockVerify.mockReset();
  mockGetDoc.mockReset();
  mockGetStoredGeminiKey.mockReset();
  mockCreateGeminiRunner.mockClear();
});

describe('POST /api/coach — AI Coach is a Pro feature, enforced server-side', () => {
  it('rejects with 401 when there is no Authorization header at all (no more "falls back to shared AI" for anonymous callers)', async () => {
    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, null) } as never);
    expect(res.status).toBe(401);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the token fails verification', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'garbage-token') } as never);
    expect(res.status).toBe(401);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('FREE: rejected with 403 and an upgrade message, never reaches the AI runner', async () => {
    mockVerify.mockResolvedValue({ uid: 'free-uid', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });

    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'valid-token') } as never);

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error?: string; message?: string };
    expect(json.error).toBe('AI Coach is a Pro feature');
    expect(json.message).toBe('AI Coach is available on Pro. Upgrade to unlock personalised AI guidance.');
    expect(mockGetStoredGeminiKey).not.toHaveBeenCalled();
  });

  it('FREE: a forged plan/unlimited/admin claim in the request body is ignored — server-resolved Firestore plan still blocks the request', async () => {
    mockVerify.mockResolvedValue({ uid: 'free-uid', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });

    const res = await POST({
      request: makeRequest({ question: 'why?', audit: sampleAudit, plan: 'admin', uid: 'someone-else', email: 'deanburt1308@gmail.com' }, 'valid-token'),
    } as never);

    expect(res.status).toBe(403);
  });

  it('PRO: allowed through to the AI runner', async () => {
    mockVerify.mockResolvedValue({ uid: 'pro-uid', email: 'pro@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockGetStoredGeminiKey.mockResolvedValue('user-own-key');

    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'valid-token') } as never);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { answer?: string };
    expect(json.answer).toBe('gemini answer');
  });

  it('ADMIN: allowed through regardless of the Firestore billing plan field', async () => {
    mockVerify.mockResolvedValue({ uid: 'admin-uid', email: 'deanburt1308@gmail.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' }); // admin status must win regardless of billing plan
    mockGetStoredGeminiKey.mockResolvedValue('user-own-key');

    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'valid-token') } as never);

    expect(res.status).toBe(200);
  });

  it("PRO: with a valid token and a saved Gemini key, uses the caller's own key — a forged email/uid in the body has no effect", async () => {
    mockVerify.mockResolvedValue({ uid: 'real-uid', email: 'real@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockGetStoredGeminiKey.mockResolvedValue('user-own-key');

    const res = await POST({
      request: makeRequest({ question: 'why?', audit: sampleAudit, uid: 'someone-else', email: 'attacker@example.com' }, 'valid-token'),
    } as never);

    expect(mockGetStoredGeminiKey).toHaveBeenCalledWith(expect.anything(), 'real-uid');
    expect(mockCreateGeminiRunner).toHaveBeenCalledWith('user-own-key');
    expect(res.status).toBe(200);
  });

  it('PRO: with no saved Gemini key, does not create a Gemini runner (falls back to shared AI, 503 in this test env)', async () => {
    mockVerify.mockResolvedValue({ uid: 'real-uid', email: 'real@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockGetStoredGeminiKey.mockResolvedValue(undefined);

    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'valid-token') } as never);

    expect(mockCreateGeminiRunner).not.toHaveBeenCalled();
    expect(res.status).toBe(503); // no env.AI available in this test environment either
  });
});
