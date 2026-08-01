import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  env: { FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'sa@test', private_key: 'key', project_id: 'test-project' }) },
}));

vi.mock('../verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

vi.mock('../gemini', () => ({
  getStoredGeminiKey: vi.fn(),
  createGeminiRunner: vi.fn(() => ({ run: vi.fn().mockResolvedValue({ response: 'gemini answer' }) })),
}));

import { POST } from '../../../pages/api/coach';
import { verifyFirebaseIdToken } from '../verifyFirebaseIdToken';
import { getStoredGeminiKey, createGeminiRunner } from '../gemini';

const mockVerify = vi.mocked(verifyFirebaseIdToken);
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
// `env.AI` to fall back to here — these tests only exercise which AI runner gets selected
// (shared vs. the caller's own Gemini key), not the shared-AI call itself.
beforeEach(() => {
  vi.stubEnv('PUBLIC_FIREBASE_PROJECT_ID', 'test-project');
  mockVerify.mockReset();
  mockGetStoredGeminiKey.mockReset();
  mockCreateGeminiRunner.mockClear();
});

describe('POST /api/coach — Gemini key selection', () => {
  it('with no Authorization header, never looks up a Gemini key (falls back to shared AI unaffected, exactly as before)', async () => {
    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, null) } as never);
    // No env.AI in this test env either, so this 503s — the point is it never looked up a key.
    expect(res.status).toBe(503);
    expect(mockGetStoredGeminiKey).not.toHaveBeenCalled();
    expect(mockCreateGeminiRunner).not.toHaveBeenCalled();
  });

  it('with a valid token and a saved Gemini key, uses the caller\'s own key — a forged email/uid in the body has no effect', async () => {
    mockVerify.mockResolvedValue({ uid: 'real-uid', email: 'real@example.com' });
    mockGetStoredGeminiKey.mockResolvedValue('user-own-key');

    const res = await POST({
      request: makeRequest({ question: 'why?', audit: sampleAudit, uid: 'someone-else', email: 'attacker@example.com' }, 'valid-token'),
    } as never);

    expect(mockGetStoredGeminiKey).toHaveBeenCalledWith(expect.anything(), 'real-uid');
    expect(mockCreateGeminiRunner).toHaveBeenCalledWith('user-own-key');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { answer?: string };
    expect(json.answer).toBe('gemini answer');
  });

  it('with a valid token but no saved Gemini key, does not create a Gemini runner (falls back to shared AI)', async () => {
    mockVerify.mockResolvedValue({ uid: 'real-uid', email: 'real@example.com' });
    mockGetStoredGeminiKey.mockResolvedValue(undefined);

    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'valid-token') } as never);

    expect(mockCreateGeminiRunner).not.toHaveBeenCalled();
    expect(res.status).toBe(503); // no env.AI available in this test environment either
  });

  it('an invalid/expired token behaves exactly like no token — never looks up a key', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST({ request: makeRequest({ question: 'why?', audit: sampleAudit }, 'garbage-token') } as never);
    expect(res.status).toBe(503);
    expect(mockGetStoredGeminiKey).not.toHaveBeenCalled();
  });
});
