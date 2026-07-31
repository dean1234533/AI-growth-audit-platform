import { describe, it, expect } from 'vitest';
import { classifyLinkStatus, discoverPages } from '../fetchSite';

describe('classifyLinkStatus', () => {
  it('classifies a 403 as blocked, not broken (Instagram bot-protection case)', () => {
    expect(classifyLinkStatus(403, false)).toBe('blocked');
  });

  it('classifies a 429 as blocked', () => {
    expect(classifyLinkStatus(429, false)).toBe('blocked');
  });

  it('classifies a 404 as broken', () => {
    expect(classifyLinkStatus(404, false)).toBe('broken');
  });

  it('classifies a 500 as broken', () => {
    expect(classifyLinkStatus(500, false)).toBe('broken');
  });

  it('classifies a 200 as verified', () => {
    expect(classifyLinkStatus(200, false)).toBe('verified');
  });

  it('classifies a followed redirect as redirects, not a failure', () => {
    expect(classifyLinkStatus(200, true)).toBe('redirects');
  });

  it('classifies a total network failure (no response at all) as not_verified, not broken', () => {
    expect(classifyLinkStatus(null, false)).toBe('not_verified');
  });
});

describe('discoverPages', () => {
  it('discovers pages from rendered-DOM links that a static fetch never saw (JS-only nav case)', () => {
    const homepageUrl = 'https://example.com/';
    const staticLinks: { href: string }[] = []; // nothing in the raw HTML — the SPA-nav scenario
    const renderedLinks = [{ href: '/areas/wanstead' }, { href: '/contact' }];
    const discovered = discoverPages(homepageUrl, null, staticLinks, 8, renderedLinks);
    expect(discovered).toContain('https://example.com/areas/wanstead');
    expect(discovered).toContain('https://example.com/contact');
  });

  it('never crawls off-host links', () => {
    const discovered = discoverPages('https://example.com/', null, [{ href: 'https://other-site.com/contact' }], 8);
    expect(discovered).toHaveLength(0);
  });
});
