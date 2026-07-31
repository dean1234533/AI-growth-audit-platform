import { describe, it, expect } from 'vitest';
import { makePageData, findCheck } from '../__fixtures__/pageData';
import { runSeoChecks } from '../seo';
import type { LinkCheckResult } from '../../fetchSite';


describe('seo.breadcrumbSchema', () => {
  it('is not_applicable on the homepage, never a fail', () => {
    const page = makePageData({ finalUrl: 'https://example.com/', jsonLd: [] });
    const check = findCheck(runSeoChecks(page, null, null), 'seo.breadcrumbSchema');
    expect(check.status).toBe('not_applicable');
    expect(check.weight).toBe(0);
    expect(check.detail).not.toMatch(/no.*found/i);
  });

  it('passes on a non-homepage page with matching schema', () => {
    const page = makePageData({
      finalUrl: 'https://example.com/tools/some-tool',
      jsonLd: [{ '@type': 'BreadcrumbList', itemListElement: [] }],
    });
    const check = findCheck(runSeoChecks(page, null, null), 'seo.breadcrumbSchema');
    expect(check.passed).toBe(true);
    expect(check.status).toBeUndefined();
  });

  it('genuinely fails on a non-homepage page with no schema', () => {
    const page = makePageData({ finalUrl: 'https://example.com/tools/some-tool', jsonLd: [] });
    const check = findCheck(runSeoChecks(page, null, null), 'seo.breadcrumbSchema');
    expect(check.passed).toBe(false);
    expect(check.status).toBeUndefined();
  });

  it('finds a BreadcrumbList nested inside an @graph-wrapped block (caught live in remote testing)', () => {
    const page = makePageData({
      finalUrl: 'https://example.com/tools/some-tool',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'BreadcrumbList', itemListElement: [] },
            { '@type': 'SoftwareApplication', name: 'Some Tool' },
            { '@type': 'FAQPage', mainEntity: [] },
          ],
        },
      ],
    });
    const checks = runSeoChecks(page, null, null);
    expect(findCheck(checks, 'seo.breadcrumbSchema').passed).toBe(true);
    expect(findCheck(checks, 'seo.faqSchema').passed).toBe(true);
  });
});

describe('seo.brokenLinks / seo.blockedLinks', () => {
  it('a bot-blocked link (403, e.g. Instagram) never counts as broken', () => {
    const page = makePageData();
    const linkCheckResults: LinkCheckResult[] = [
      { href: 'https://www.instagram.com/deanda.dev', status: 403, ok: true, isInternal: false, confidence: 'blocked' },
    ];
    const checks = runSeoChecks(page, null, null, { linkCheckResults });
    expect(findCheck(checks, 'seo.brokenExternalLinks').passed).toBe(true);
    const blockedCheck = findCheck(checks, 'seo.blockedLinks');
    expect(blockedCheck.status).toBe('not_verified');
    expect(blockedCheck.detail).toMatch(/could not be independently verified/i);
  });

  it('a genuine 404 still counts as broken', () => {
    const page = makePageData();
    const linkCheckResults: LinkCheckResult[] = [
      { href: 'https://example.com/dead-page', status: 404, ok: false, isInternal: true, confidence: 'broken' },
    ];
    const checks = runSeoChecks(page, null, null, { linkCheckResults });
    expect(findCheck(checks, 'seo.brokenLinks').passed).toBe(false);
  });
});
