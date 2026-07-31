import { describe, it, expect } from 'vitest';
import { makePageData, makeRenderedPageData, findCheck } from '../__fixtures__/pageData';
import { runSeoChecks } from '../seo';
import { runAccessibilityChecks } from '../accessibility';
import { runMobileChecks } from '../mobile';
import { runConversionChecks } from '../conversion';


/**
 * The exact scenario that produced this whole rewrite: a client-rendered SPA whose raw HTML
 * is just an empty <div id="root">, so a static-only scan wrongly concludes the H1, CTA,
 * contact form, and everything else "doesn't exist." Every one of these must now pass once
 * real rendered data is supplied — and none of them may pass on the static-only data alone,
 * proving the fix is actually exercised rather than coincidentally always-true.
 */
describe('SPA regression: static HTML empty, rendered content present', () => {
  const staticPage = makePageData({
    html: '<html><body><div id="root"></div></body></html>',
    bodyText: '',
    h1s: [],
    headings: [],
    forms: [],
  });

  const rendered = makeRenderedPageData({
    h1s: ['Apps, websites, AI tools, and automations built to win business.'],
    headings: [{ level: 1, text: 'Apps, websites, AI tools, and automations built to win business.' }],
    visibleText: 'Book a discovery call. 9 verified Google Reviews. 5.0 out of 5.',
    buttons: [{ text: 'Book a discovery call', hasAccessibleName: true, visible: true }],
    links: [{ href: '/DiscoveryCall', text: 'Book a discovery call' }],
    forms: [{ fieldCount: 3, unlabelledFieldCount: 0 }],
    focusTest: { sampled: 5, withVisibleIndicator: 5 },
    viewportOverflow: [
      { width: 375, overflowPx: 0 },
      { width: 768, overflowPx: 0 },
      { width: 1280, overflowPx: 0 },
    ],
  });

  it('static-only data does NOT find the H1 (proves the scenario is real)', () => {
    const checks = runSeoChecks(staticPage, null, null, {}, null);
    expect(findCheck(checks, 'seo.missingH1').passed).toBe(false);
  });

  it('rendered data finds the H1', () => {
    const checks = runSeoChecks(staticPage, null, null, {}, rendered);
    const h1Check = findCheck(checks, 'seo.missingH1');
    expect(h1Check.passed).toBe(true);
    expect(h1Check.measurementType).toBe('measured');
  });

  it('rendered data finds the contact form', () => {
    const checks = runConversionChecks(staticPage, rendered);
    expect(findCheck(checks, 'conv.contactForm').passed).toBe(true);
  });

  it('static-only data does not find the contact form', () => {
    const checks = runConversionChecks(staticPage, null);
    expect(findCheck(checks, 'conv.contactForm').passed).toBe(false);
  });

  it('rendered data finds the primary CTA', () => {
    const checks = runConversionChecks(staticPage, rendered);
    expect(findCheck(checks, 'conv.primaryCta').passed).toBe(true);
  });

  it('rendered focus test passes real keyboard-focus verification', () => {
    const checks = runAccessibilityChecks(staticPage, rendered);
    const check = findCheck(checks, 'a11y.focusStates');
    expect(check.passed).toBe(true);
    expect(check.measurementType).toBe('measured');
  });

  it('without rendering, focus states are not_verified, never a hard fail', () => {
    const checks = runAccessibilityChecks(staticPage, null);
    const check = findCheck(checks, 'a11y.focusStates');
    expect(check.status).toBe('not_verified');
    expect(check.weight).toBe(0);
  });

  it('rendered viewport data with zero overflow passes responsive check', () => {
    const checks = runMobileChecks(staticPage, rendered);
    const check = findCheck(checks, 'mobile.responsive');
    expect(check.passed).toBe(true);
    expect(check.measurementType).toBe('measured');
  });

  it('never reports "layout breaks" when rendered overflow is genuinely zero', () => {
    const checks = runMobileChecks(staticPage, rendered);
    const check = findCheck(checks, 'mobile.responsive');
    expect(check.detail).not.toMatch(/breaks|broken/i);
  });
});
