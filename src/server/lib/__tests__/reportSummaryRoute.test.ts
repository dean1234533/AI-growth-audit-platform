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
  createGeminiRunner: vi.fn(() => ({ run: vi.fn().mockResolvedValue({ response: 'ai written summary' }) })),
}));

import { POST } from '../../../pages/api/report-summary';
import { verifyFirebaseIdToken } from '../verifyFirebaseIdToken';
import { getFirestoreDocument } from '../firestore';
import { getStoredGeminiKey } from '../gemini';

const mockVerify = vi.mocked(verifyFirebaseIdToken);
const mockGetDoc = vi.mocked(getFirestoreDocument);
const mockGetStoredGeminiKey = vi.mocked(getStoredGeminiKey);

const sampleDigest = {
  siteName: 'Example Site',
  siteUrl: 'https://example.com',
  currentScore: 80,
  previousScore: 75,
  scoreDelta: 5,
  resolvedIssues: [],
  newIssues: [],
  topPriority: null,
};

function makeRequest(body: unknown, token: string | null): Request {
  return new Request('https://example.com/api/report-summary', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('PUBLIC_FIREBASE_PROJECT_ID', 'test-project');
  mockVerify.mockReset();
  mockGetDoc.mockReset();
  mockGetStoredGeminiKey.mockReset();
});

describe('POST /api/report-summary — AI-written reports are a Pro feature, enforced server-side', () => {
  it('rejects with 401 when there is no Authorization header', async () => {
    const res = await POST({ request: makeRequest({ digest: sampleDigest }, null) } as never);
    expect(res.status).toBe(401);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the token fails verification', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST({ request: makeRequest({ digest: sampleDigest }, 'garbage-token') } as never);
    expect(res.status).toBe(401);
  });

  it('FREE: rejected with 403 and an upgrade message', async () => {
    mockVerify.mockResolvedValue({ uid: 'free-uid', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });

    const res = await POST({ request: makeRequest({ digest: sampleDigest }, 'valid-token') } as never);

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error?: string; message?: string };
    expect(json.error).toBe('AI reports are a Pro feature');
    expect(json.message).toBe('AI-written reports are available on Pro. Upgrade to unlock weekly AI report summaries.');
  });

  it('FREE: a forged plan/admin-email claim in the request body has no effect', async () => {
    mockVerify.mockResolvedValue({ uid: 'free-uid', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });

    const res = await POST({
      request: makeRequest({ digest: sampleDigest, plan: 'admin', email: 'deanburt1308@gmail.com' }, 'valid-token'),
    } as never);

    expect(res.status).toBe(403);
  });

  it('PRO: allowed through to the AI runner', async () => {
    mockVerify.mockResolvedValue({ uid: 'pro-uid', email: 'pro@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockGetStoredGeminiKey.mockResolvedValue('user-own-key');

    const res = await POST({ request: makeRequest({ digest: sampleDigest }, 'valid-token') } as never);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { summary?: string };
    expect(json.summary).toBe('ai written summary');
  });

  it('ADMIN: allowed through regardless of the Firestore billing plan field', async () => {
    mockVerify.mockResolvedValue({ uid: 'admin-uid', email: 'deanburt1308@gmail.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockGetStoredGeminiKey.mockResolvedValue('user-own-key');

    const res = await POST({ request: makeRequest({ digest: sampleDigest }, 'valid-token') } as never);

    expect(res.status).toBe(200);
  });
});
