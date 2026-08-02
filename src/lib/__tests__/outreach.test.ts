import { describe, it, expect } from 'vitest';
import { buildRecommendations } from '../recommendations';
import {
  buildEmailTemplate,
  buildWhatsAppTemplate,
  buildOutreachMessages,
  selectOutreachFindings,
  AUDIT_TOOL_URL,
} from '../outreach';
import type { AuditResult, CheckResult } from '../types';

function check(overrides: Partial<CheckResult>): CheckResult {
  return {
    id: 'seo.missingTitle',
    category: 'seo',
    label: 'Page title present',
    passed: false,
    detail: 'No <title> tag found',
    severity: 'high',
    weight: 10,
    measurementType: 'detected',
    ...overrides,
  };
}

const URL = 'https://example-plumber.co.uk/';

// ── Scenario fixtures ──────────────────────────────────────────────────────

const POOR_LOCAL_BUSINESS_CHECKS: CheckResult[] = [
  check({ id: 'conv.primaryCta', category: 'conversion', label: 'Clear primary call-to-action present', severity: 'critical', weight: 10, detail: 'No clear call-to-action phrasing found on the page' }),
  check({ id: 'conv.contactForm', category: 'conversion', label: 'Contact/enquiry form present', severity: 'high', weight: 9, detail: 'No forms found on homepage' }),
  check({ id: 'trust.contactPage', category: 'trust', label: 'Contact page linked', severity: 'high', weight: 8, detail: 'No contact page link found' }),
  check({ id: 'local.gbp', category: 'localSeo', label: 'Google Business Profile linked', severity: 'high', weight: 10, detail: 'No Google Business Profile link found' }),
  check({ id: 'seo.missingTitle', category: 'seo', label: 'Page title present', severity: 'critical', weight: 10, detail: 'No <title> tag found' }),
  check({ id: 'mobile.responsive', category: 'mobile', label: 'Content fits mobile viewport', severity: 'high', weight: 8, detail: 'Layout overflows at 375px width' }),
];

const GOOD_SITE_CHECKS: CheckResult[] = [
  check({ id: 'seo.metaDescriptionLength', category: 'seo', label: 'Meta description length optimal', severity: 'low', weight: 4, detail: 'Meta description is 210 characters' }),
  check({ id: 'conv.multipleCtas', category: 'conversion', label: 'Call-to-action repeated on page', severity: 'medium', weight: 5, detail: '1 CTA phrase occurrence(s) found' }),
];

const MOSTLY_SEO_CHECKS: CheckResult[] = [
  check({ id: 'seo.missingMetaDescription', category: 'seo', label: 'Meta description present', severity: 'high', weight: 8, detail: 'No meta description found' }),
  check({ id: 'seo.canonical', category: 'seo', label: 'Canonical URL present', severity: 'low', weight: 3, detail: 'No canonical tag found' }),
  check({ id: 'seo.sitemap', category: 'seo', label: 'sitemap.xml present', severity: 'low', weight: 3, detail: 'No sitemap.xml found' }),
  check({ id: 'seo.robotsTxt', category: 'seo', label: 'robots.txt present', severity: 'low', weight: 3, detail: 'No robots.txt found' }),
  check({ id: 'seo.missingH1', category: 'seo', label: 'Exactly one H1 present', severity: 'high', weight: 8, detail: 'No H1 tag found' }),
];

const CONVERSION_ISSUES_CHECKS: CheckResult[] = [
  check({ id: 'conv.pricingInfo', category: 'conversion', label: 'Pricing information visible', severity: 'medium', weight: 5, detail: 'No pricing information found' }),
  check({ id: 'conv.faqSection', category: 'conversion', label: 'FAQ section present', severity: 'medium', weight: 4, detail: 'No FAQ section found' }),
  check({ id: 'conv.trustBadges', category: 'conversion', label: 'Trust badges near content', severity: 'medium', weight: 5, detail: 'No trust badge keywords found' }),
  check({ id: 'trust.testimonials', category: 'trust', label: 'Testimonials present', severity: 'info', weight: 0, detail: 'No testimonial text found', status: 'not_verified' }),
];

const PERFORMANCE_ISSUES_CHECKS: CheckResult[] = [
  check({ id: 'perf.lcp', category: 'performance', label: 'Largest Contentful Paint under 2.5s', severity: 'critical', weight: 10, detail: '6.8 s', measurementType: 'measured' }),
  check({ id: 'perf.fcp', category: 'performance', label: 'First Contentful Paint under 1.8s', severity: 'high', weight: 7, detail: '3.9 s', measurementType: 'measured' }),
  check({ id: 'perf.unusedJs', category: 'performance', label: 'Minimal unused JavaScript', severity: 'medium', weight: 5, detail: 'Est savings of 400 KiB', measurementType: 'measured' }),
];

function makeAudit(checks: CheckResult[], meta: Partial<AuditResult['meta']> = {}): AuditResult {
  const recommendations = buildRecommendations(checks.filter((c) => c.weight > 0 && !c.passed), URL);
  return {
    url: URL,
    scannedAt: '2026-08-02T00:00:00Z',
    overallScore: 50,
    categories: [],
    recommendations,
    growthEstimate: { additionalEnquiriesPerMonth: [0, 0], visibilityImprovementPct: 0, conversionImprovementPct: 0, speedImprovementPct: 0, accessibilityImprovementPct: 0 },
    meta: { pageTitle: 'Example', partial: false, warnings: [], ...meta },
  };
}

// ── selectOutreachFindings ──────────────────────────────────────────────────

describe('selectOutreachFindings', () => {
  it('prefers relatable categories (conversion/trust/local) over purely technical SEO findings', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS);
    const picked = selectOutreachFindings(audit.recommendations);
    expect(picked.length).toBeGreaterThan(0);
    expect(['conversion', 'trust', 'localSeo', 'mobile']).toContain(picked[0].category);
  });

  it('never returns more than `max`', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS);
    expect(selectOutreachFindings(audit.recommendations, 2)).toHaveLength(2);
    expect(selectOutreachFindings(audit.recommendations, 1)).toHaveLength(1);
  });

  it('falls back to technical findings when nothing relatable exists (mostly-SEO site)', () => {
    const audit = makeAudit(MOSTLY_SEO_CHECKS);
    const picked = selectOutreachFindings(audit.recommendations);
    expect(picked.length).toBeGreaterThan(0);
  });

  it('returns an empty array (never a fabricated finding) when there is nothing to report', () => {
    const audit = makeAudit([]);
    expect(selectOutreachFindings(audit.recommendations)).toEqual([]);
  });
});

// ── Template content rules — apply across every scenario ───────────────────

const SCENARIOS: [string, CheckResult[]][] = [
  ['poor-performing local business', POOR_LOCAL_BUSINESS_CHECKS],
  ['good site, minor issues', GOOD_SITE_CHECKS],
  ['mostly SEO issues', MOSTLY_SEO_CHECKS],
  ['conversion issues', CONVERSION_ISSUES_CHECKS],
  ['performance issues', PERFORMANCE_ISSUES_CHECKS],
];

describe.each(SCENARIOS)('outreach templates — %s', (_label, checks) => {
  const audit = makeAudit(checks, { businessName: 'Riverside Plumbing', businessType: 'plumbing' });
  const messages = buildOutreachMessages(audit, { contactName: 'Sam' });

  it('every channel opens by establishing Dean as a web developer', () => {
    expect(messages.email.body).toMatch(/I'm Dean — I'm a web developer/);
    expect(messages.whatsapp).toMatch(/I'm Dean, a web developer/);
    expect(messages.instagram).toMatch(/I'm Dean — I'm a web developer/);
  });

  it('every channel includes the audit tool URL as the primary link', () => {
    expect(messages.email.body).toContain(AUDIT_TOOL_URL);
    expect(messages.whatsapp).toContain(AUDIT_TOOL_URL);
    expect(messages.instagram).toContain(AUDIT_TOOL_URL);
  });

  it('never leaks a raw internal check id (e.g. "conv.primaryCta", "seo.missingTitle")', () => {
    const idPattern = /\b(conv|seo|trust|local|mobile|perf|a11y)\.[a-zA-Z]+\b/;
    expect(messages.email.subject).not.toMatch(idPattern);
    expect(messages.email.body).not.toMatch(idPattern);
    expect(messages.whatsapp).not.toMatch(idPattern);
    expect(messages.instagram).not.toMatch(idPattern);
  });

  it('never mentions admin/unlimited access', () => {
    for (const text of [messages.email.body, messages.whatsapp, messages.instagram]) {
      expect(text.toLowerCase()).not.toContain('admin');
      expect(text.toLowerCase()).not.toContain('unlimited');
    }
  });

  it('never uses a hard-sell phrase not supported by the audit', () => {
    const bannedPhrases = [/losing customers/i, /costing you thousands/i, /i can build you a new website/i, /i can fix all of this for you/i];
    for (const text of [messages.email.body, messages.whatsapp, messages.instagram]) {
      for (const banned of bannedPhrases) expect(text).not.toMatch(banned);
    }
  });

  it('email explains the free-audit-vs-account distinction without repeatedly saying "free" with no context', () => {
    expect(messages.email.body).toMatch(/no signup needed/i);
    expect(messages.email.body).toMatch(/free account/i);
  });

  it('email subject is personalised with the business name', () => {
    expect(messages.email.subject).toBe('Quick website check for Riverside Plumbing');
  });

  it('whatsapp and instagram stay short (genuinely conversational length, not an email pasted into chat)', () => {
    expect(messages.whatsapp.length).toBeLessThan(400);
    expect(messages.instagram.length).toBeLessThan(400);
  });
});

// ── Personalisation ──────────────────────────────────────────────────────

describe('personalisation', () => {
  it('uses the contact name when provided', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing' });
    const messages = buildOutreachMessages(audit, { contactName: 'Sam' });
    expect(messages.email.body).toMatch(/^Hi Sam,/);
  });

  it('falls back to a generic greeting when no contact name is known', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing' });
    const messages = buildOutreachMessages(audit);
    expect(messages.email.body).toMatch(/^Hi,/);
  });

  it('mentions the industry when known', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing', businessType: 'plumbing' });
    const messages = buildOutreachMessages(audit);
    expect(messages.email.body).toContain('plumbing businesses');
  });

  it('omits industry gracefully when unknown, without a broken sentence', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing' });
    const messages = buildOutreachMessages(audit);
    expect(messages.email.body).toContain('local businesses');
    expect(messages.email.body).not.toContain('undefined');
  });

  it('derives a business name from the URL when meta.businessName is absent', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS);
    const messages = buildOutreachMessages(audit);
    expect(messages.email.subject).toContain('example-plumber.co.uk');
  });

  it('never forces a numeric score into the message', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing' });
    const messages = buildOutreachMessages(audit);
    expect(messages.email.body).not.toMatch(/\b\d{1,3}\/100\b/);
    expect(messages.whatsapp).not.toMatch(/\b\d{1,3}\/100\b/);
  });

  it('only shows the portfolio link when explicitly supplied, and never as the primary CTA', () => {
    const audit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing' });
    const withoutPortfolio = buildOutreachMessages(audit);
    expect(withoutPortfolio.email.body).not.toContain('portfolio');

    const withPortfolio = buildOutreachMessages(audit, { portfolioUrl: 'https://dean-da-dev.co.uk/' });
    expect(withPortfolio.email.body).toContain('https://dean-da-dev.co.uk/');
    // the audit tool link must still appear before the portfolio link in the email body
    expect(withPortfolio.email.body.indexOf(AUDIT_TOOL_URL)).toBeLessThan(withPortfolio.email.body.indexOf('https://dean-da-dev.co.uk/'));
  });
});

// ── Messages don't sound repetitive across different scenarios ─────────────

describe('messages vary meaningfully across different audit outcomes', () => {
  it('whatsapp messages for different scenarios are not identical', () => {
    const texts = SCENARIOS.map(([, checks]) => {
      const audit = makeAudit(checks, { businessName: 'Riverside Plumbing', businessType: 'plumbing' });
      return buildWhatsAppTemplate({ businessName: 'Riverside Plumbing', industry: 'plumbing', recommendations: audit.recommendations });
    });
    const unique = new Set(texts);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('a good site with minor issues gets a softer opening line than a poor site with critical issues', () => {
    const goodAudit = makeAudit(GOOD_SITE_CHECKS, { businessName: 'Riverside Plumbing' });
    const poorAudit = makeAudit(POOR_LOCAL_BUSINESS_CHECKS, { businessName: 'Riverside Plumbing' });
    const goodEmail = buildEmailTemplate({ businessName: 'Riverside Plumbing', recommendations: goodAudit.recommendations });
    const poorEmail = buildEmailTemplate({ businessName: 'Riverside Plumbing', recommendations: poorAudit.recommendations });
    expect(goodEmail.body).toMatch(/pretty good shape/i);
    expect(poorEmail.body).not.toMatch(/pretty good shape/i);
  });
});
