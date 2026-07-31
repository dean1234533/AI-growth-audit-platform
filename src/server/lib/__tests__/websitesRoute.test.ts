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
    runQuery: vi.fn(),
    addFirestoreDocument: vi.fn(),
  };
});

import { POST, GET } from '../../../pages/api/websites';
import { verifyFirebaseIdToken } from '../verifyFirebaseIdToken';
import { getFirestoreDocument, runQuery, addFirestoreDocument } from '../firestore';

const mockVerify = vi.mocked(verifyFirebaseIdToken);
const mockGetDoc = vi.mocked(getFirestoreDocument);
const mockRunQuery = vi.mocked(runQuery);
const mockAddDoc = vi.mocked(addFirestoreDocument);

function makeRequest(body: unknown, token: string | null = 'valid-token'): Request {
  return new Request('https://example.com/api/websites', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const sampleAudit = {
  url: 'https://real-owner-site.example.com',
  scannedAt: '2026-07-31T00:00:00Z',
  overallScore: 80,
  categories: [{ id: 'seo', label: 'SEO', score: 80, checks: [] }],
  recommendations: [],
  growthEstimate: {
    additionalEnquiriesPerMonth: [0, 1],
    visibilityImprovementPct: 0,
    conversionImprovementPct: 0,
    speedImprovementPct: 0,
    accessibilityImprovementPct: 0,
  },
  meta: { pageTitle: 't', partial: false, warnings: [] },
};

beforeEach(() => {
  vi.stubEnv('PUBLIC_FIREBASE_PROJECT_ID', 'test-project');
  mockVerify.mockReset();
  mockGetDoc.mockReset();
  mockRunQuery.mockReset();
  mockAddDoc.mockReset();
  mockAddDoc.mockResolvedValue('new-website-id');
});

describe('POST /api/websites — security', () => {
  it('rejects with 401 when there is no Authorization header at all', async () => {
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }, null) } as never);
    expect(res.status).toBe(401);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the token fails verification (cannot spoof identity)', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }) } as never);
    expect(res.status).toBe(401);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('a user cannot create a website belonging to another user — a forged uid in the body is ignored, the verified token uid is always used', async () => {
    mockVerify.mockResolvedValue({ uid: 'real-user-uid', email: 'real-user@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' }); // pro: room for more
    mockRunQuery.mockResolvedValue([]); // 0 existing websites

    const res = await POST({
      request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit, uid: 'someone-elses-uid' }),
    } as never);

    expect(res.status).toBe(200);
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), 'websites', expect.objectContaining({ uid: 'real-user-uid' }));
    expect(mockAddDoc).not.toHaveBeenCalledWith(expect.anything(), 'websites', expect.objectContaining({ uid: 'someone-elses-uid' }));
  });

  it('a user cannot spoof their plan — a forged plan/unlimited/maxWebsites in the body is ignored; the server-resolved plan (free, from Firestore) still blocks a 2nd website', async () => {
    mockVerify.mockResolvedValue({ uid: 'free-user-uid', email: 'free-user@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockRunQuery.mockResolvedValue([{ id: 'existing-site' }]); // already has 1

    const res = await POST({
      request: makeRequest({
        url: 'https://x.com',
        frequency: 'weekly',
        audit: sampleAudit,
        plan: 'admin',
        unlimited: true,
        maxWebsites: 999,
      }),
    } as never);

    expect(res.status).toBe(403);
    const json = (await res.json()) as any;
    expect(json.error).toBe('Website limit reached');
    expect(json.message).toBe('You can have 1 website on the Free plan. Upgrade to monitor up to 5 websites.');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('a user cannot spoof admin status by claiming the admin email in the request body — only the verified token email counts', async () => {
    mockVerify.mockResolvedValue({ uid: 'attacker-uid', email: 'attacker@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockRunQuery.mockResolvedValue([{ id: 'existing-site' }]); // already at the free limit

    const res = await POST({
      request: makeRequest({
        url: 'https://x.com',
        frequency: 'weekly',
        audit: sampleAudit,
        email: 'deanburt1308@gmail.com', // forged — the real identity source is the verified token, set above to attacker@example.com
      }),
    } as never);

    expect(res.status).toBe(403);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('FREE: 0 websites → can add', async () => {
    mockVerify.mockResolvedValue({ uid: 'u1', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockRunQuery.mockResolvedValue([]);
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }) } as never);
    expect(res.status).toBe(200);
  });

  it('FREE: 1 website → 2nd website rejected', async () => {
    mockVerify.mockResolvedValue({ uid: 'u1', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockRunQuery.mockResolvedValue([{ id: 'a' }]);
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }) } as never);
    expect(res.status).toBe(403);
  });

  it('PAID: 5 websites allowed (4 existing → 5th succeeds)', async () => {
    mockVerify.mockResolvedValue({ uid: 'u2', email: 'pro@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockRunQuery.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }) } as never);
    expect(res.status).toBe(200);
  });

  it('PAID: 6th website rejected', async () => {
    mockVerify.mockResolvedValue({ uid: 'u2', email: 'pro@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockRunQuery.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]);
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }) } as never);
    expect(res.status).toBe(403);
    const json = (await res.json()) as any;
    expect(json.message).toBe('You can have up to 5 websites on your current plan.');
  });

  it('ADMIN: many more than 5 websites still allowed — no practical limit', async () => {
    mockVerify.mockResolvedValue({ uid: 'admin-uid', email: 'deanburt1308@gmail.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' }); // admin status must win regardless of billing plan
    mockRunQuery.mockResolvedValue(Array.from({ length: 100 }, (_, i) => ({ id: `site-${i}` })));
    const res = await POST({ request: makeRequest({ url: 'https://x.com', frequency: 'weekly', audit: sampleAudit }) } as never);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/websites — quota', () => {
  it('reports "1 / 1" shape for a free user at their limit', async () => {
    mockVerify.mockResolvedValue({ uid: 'u1', email: 'free@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockRunQuery.mockResolvedValue([{ id: 'a' }]);
    const res = await GET({ request: makeRequest({}) } as never);
    const json = (await res.json()) as any;
    expect(json).toMatchObject({ planId: 'free', currentCount: 1, maxWebsites: 1, unlimited: false, canAdd: false });
  });

  it('reports "3 / 5" shape for a paid user', async () => {
    mockVerify.mockResolvedValue({ uid: 'u2', email: 'pro@example.com' });
    mockGetDoc.mockResolvedValue({ plan: 'pro' });
    mockRunQuery.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const res = await GET({ request: makeRequest({}) } as never);
    const json = (await res.json()) as any;
    expect(json).toMatchObject({ planId: 'pro', currentCount: 3, maxWebsites: 5, unlimited: false, canAdd: true });
  });

  it('reports unlimited for admin, with no limit message', async () => {
    mockVerify.mockResolvedValue({ uid: 'admin-uid', email: 'deanburt1308@gmail.com' });
    mockGetDoc.mockResolvedValue({ plan: 'free' });
    mockRunQuery.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `site-${i}` })));
    const res = await GET({ request: makeRequest({}) } as never);
    const json = (await res.json()) as any;
    expect(json).toMatchObject({ planId: 'admin', currentCount: 12, maxWebsites: null, unlimited: true, canAdd: true, limitMessage: null });
  });
});
