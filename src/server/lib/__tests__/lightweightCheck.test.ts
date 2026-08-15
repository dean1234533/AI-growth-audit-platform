import { describe, it, expect } from 'vitest';
import { checkSiteReachable } from '../lightweightCheck';
import type { Fetcher } from '../fetchSite';

function makeFetcher(status: number, body = ''): Fetcher {
  return async () => new Response(body, { status });
}

function throwingFetcher(): Fetcher {
  return async () => {
    throw new Error('network failure');
  };
}

describe('checkSiteReachable', () => {
  it('is up on a 200 response and extracts title + content length', async () => {
    const result = await checkSiteReachable(
      'https://example.com/',
      makeFetcher(200, '<html><head><title>Joe\'s Plumbing</title></head><body><h1>Welcome</h1><p>Call us for a free quote.</p></body></html>'),
    );
    expect(result.up).toBe(true);
    expect(result.status).toBe(200);
    expect(result.title).toBe("Joe's Plumbing");
    expect(result.contentLength).toBeGreaterThan(0);
  });

  it('is still up on a 404 — the server responded, the page just does not exist', async () => {
    const result = await checkSiteReachable('https://example.com/', makeFetcher(404, '<title>Not Found</title>'));
    expect(result.up).toBe(true);
    expect(result.status).toBe(404);
  });

  it('is down on a 500 server error', async () => {
    const result = await checkSiteReachable('https://example.com/', makeFetcher(503));
    expect(result.up).toBe(false);
    expect(result.status).toBe(503);
  });

  it('is down when the fetch throws (network failure/timeout), with no title/content', async () => {
    const result = await checkSiteReachable('https://example.com/', throwingFetcher());
    expect(result).toEqual({ up: false, status: null, title: null, contentLength: 0 });
  });

  it('returns null title when there is no <title> tag', async () => {
    const result = await checkSiteReachable('https://example.com/', makeFetcher(200, '<html><body>Just some text.</body></html>'));
    expect(result.title).toBeNull();
  });

  it('strips script/style content out of contentLength, not just tags', async () => {
    const withNoise = await checkSiteReachable(
      'https://example.com/',
      makeFetcher(200, '<html><body><script>var junkJunkJunkJunkJunkJunkJunkJunkJunkJunk = 1;</script><p>Hi</p></body></html>'),
    );
    // Only "Hi" should count — the script contents must not inflate the content-length signal.
    expect(withNoise.contentLength).toBeLessThan(10);
  });
});
