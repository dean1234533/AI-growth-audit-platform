import { describe, it, expect, vi } from 'vitest';
import { resolveFetcher } from '../selfFetch';

const SELF_HOSTNAMES = 'app.dean-da-dev.co.uk,ai-website-growth-audit-platform.deanburt1308.workers.dev';

function makeSelfBinding() {
  return { fetch: vi.fn(async () => new Response('ok')) };
}

describe('resolveFetcher', () => {
  it('returns the SELF-binding fetcher for a hostname in SELF_HOSTNAMES', async () => {
    const SELF = makeSelfBinding();
    const fetcher = resolveFetcher('https://app.dean-da-dev.co.uk/', { SELF, SELF_HOSTNAMES });
    expect(fetcher).toBeDefined();
    await fetcher!('https://app.dean-da-dev.co.uk/', { method: 'GET' });
    expect(SELF.fetch).toHaveBeenCalledWith('https://app.dean-da-dev.co.uk/', { method: 'GET' });
  });

  it('matches the second workers.dev hostname in the list too', () => {
    const SELF = makeSelfBinding();
    const fetcher = resolveFetcher('https://ai-website-growth-audit-platform.deanburt1308.workers.dev/pricing', { SELF, SELF_HOSTNAMES });
    expect(fetcher).toBeDefined();
  });

  it('returns undefined for an external hostname — falls back to the normal public fetch', () => {
    const SELF = makeSelfBinding();
    const fetcher = resolveFetcher('https://example.com/', { SELF, SELF_HOSTNAMES });
    expect(fetcher).toBeUndefined();
  });

  it('never matches on a substring/suffix — a lookalike hostname does not qualify (SSRF guard)', () => {
    const SELF = makeSelfBinding();
    expect(resolveFetcher('https://evil.com/app.dean-da-dev.co.uk', { SELF, SELF_HOSTNAMES })).toBeUndefined();
    expect(resolveFetcher('https://notapp.dean-da-dev.co.uk/', { SELF, SELF_HOSTNAMES })).toBeUndefined();
    expect(resolveFetcher('https://app.dean-da-dev.co.uk.evil.com/', { SELF, SELF_HOSTNAMES })).toBeUndefined();
  });

  it('returns undefined when SELF is not bound, even for an internal hostname (e.g. local dev)', () => {
    const fetcher = resolveFetcher('https://app.dean-da-dev.co.uk/', { SELF_HOSTNAMES });
    expect(fetcher).toBeUndefined();
  });

  it('returns undefined when SELF_HOSTNAMES is unset, even if SELF is bound', () => {
    const SELF = makeSelfBinding();
    const fetcher = resolveFetcher('https://app.dean-da-dev.co.uk/', { SELF });
    expect(fetcher).toBeUndefined();
  });

  it('returns undefined for a malformed URL rather than throwing', () => {
    const SELF = makeSelfBinding();
    expect(resolveFetcher('not a url', { SELF, SELF_HOSTNAMES })).toBeUndefined();
  });

  it('hostname matching is case-insensitive', () => {
    const SELF = makeSelfBinding();
    const fetcher = resolveFetcher('https://APP.DEAN-DA-DEV.CO.UK/', { SELF, SELF_HOSTNAMES });
    expect(fetcher).toBeDefined();
  });
});
