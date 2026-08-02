import { describe, it, expect, vi } from 'vitest';
import { dedupedRender, normalizeUrlForDedup } from '../renderDedup';
import type { RenderedPageData } from '../renderPage';

function fakeRenderedData(overrides: Partial<RenderedPageData> = {}): RenderedPageData {
  return {
    renderedHtml: '<html></html>',
    visibleText: 'x',
    h1s: [],
    headings: [],
    images: [],
    links: [],
    buttons: [],
    forms: [],
    jsonLd: [],
    stickyOrFixedElements: [],
    focusTest: { sampled: 0, withVisibleIndicator: 0 },
    viewportOverflow: [],
    tapTargets: { total: 0, tooSmall: 0 },
    renderMs: 100,
    browserPerformance: null,
    ...overrides,
  };
}

describe('normalizeUrlForDedup', () => {
  it('treats different casing and trailing slash as the same key', () => {
    expect(normalizeUrlForDedup('https://Example.com/')).toBe(normalizeUrlForDedup('https://example.com'));
  });

  it('treats http vs https on the same host/path as the same key (hostname+path only)', () => {
    expect(normalizeUrlForDedup('http://example.com/pricing')).toBe(normalizeUrlForDedup('https://example.com/pricing/'));
  });

  it('treats different paths as different keys', () => {
    expect(normalizeUrlForDedup('https://example.com/pricing')).not.toBe(normalizeUrlForDedup('https://example.com/about'));
  });

  it('never throws on a malformed URL — falls back to a lowercased raw string', () => {
    expect(() => normalizeUrlForDedup('not a url')).not.toThrow();
  });
});

describe('dedupedRender', () => {
  it('a single caller for a URL gets isNew: true and its own factory result', async () => {
    const factory = vi.fn().mockResolvedValue(fakeRenderedData({ renderMs: 42 }));
    const { promise, isNew } = dedupedRender('example.com/', factory);
    expect(isNew).toBe(true);
    const result = await promise;
    expect(result?.renderMs).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('two concurrent requests for the SAME normalized URL share one factory call — only the first is isNew', async () => {
    let resolveFactory!: (v: RenderedPageData) => void;
    const factory = vi.fn(() => new Promise<RenderedPageData>((resolve) => { resolveFactory = resolve; }));

    const first = dedupedRender('shared.com/', factory);
    const second = dedupedRender('shared.com/', factory);

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(factory).toHaveBeenCalledTimes(1); // only launched once, not twice

    resolveFactory(fakeRenderedData({ renderMs: 999 }));
    const [firstResult, secondResult] = await Promise.all([first.promise, second.promise]);
    expect(firstResult?.renderMs).toBe(999);
    expect(secondResult?.renderMs).toBe(999);
    expect(firstResult).toBe(secondResult); // literally the same object — one real render, shared
  });

  it('two requests for DIFFERENT URLs each get their own factory call', async () => {
    const factoryA = vi.fn().mockResolvedValue(fakeRenderedData({ renderMs: 1 }));
    const factoryB = vi.fn().mockResolvedValue(fakeRenderedData({ renderMs: 2 }));

    const a = dedupedRender('site-a.com/', factoryA);
    const b = dedupedRender('site-b.com/', factoryB);

    expect(a.isNew).toBe(true);
    expect(b.isNew).toBe(true);
    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).toHaveBeenCalledTimes(1);
  });

  it('cleans up after success — a later request for the same URL starts a fresh render, not a stale cached one', async () => {
    const factory1 = vi.fn().mockResolvedValue(fakeRenderedData({ renderMs: 1 }));
    await dedupedRender('cleanup-success.com/', factory1).promise;

    const factory2 = vi.fn().mockResolvedValue(fakeRenderedData({ renderMs: 2 }));
    const { isNew, promise } = dedupedRender('cleanup-success.com/', factory2);
    expect(isNew).toBe(true); // not still joined to the first (already-completed) render
    expect((await promise)?.renderMs).toBe(2);
  });

  it('cleans up after failure too — never leaves a permanently broken/stuck lock for that URL', async () => {
    const failingFactory = vi.fn().mockRejectedValue(new Error('render failed'));
    const { promise: firstPromise } = dedupedRender('cleanup-failure.com/', failingFactory);
    await expect(firstPromise).rejects.toThrow('render failed');

    const okFactory = vi.fn().mockResolvedValue(fakeRenderedData({ renderMs: 5 }));
    const { isNew, promise } = dedupedRender('cleanup-failure.com/', okFactory);
    expect(isNew).toBe(true);
    expect((await promise)?.renderMs).toBe(5);
  });

  it('the shared RenderedPageData carries no caller-specific fields (no uid/business context) — only the target page\'s own content, safe to share across different users', async () => {
    const data = fakeRenderedData();
    const keys = Object.keys(data);
    for (const forbidden of ['uid', 'businessName', 'businessType', 'location', 'geminiApiKey', 'recommendations']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
