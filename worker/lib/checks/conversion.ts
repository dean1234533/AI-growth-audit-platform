import type { CheckResult } from '../../../src/lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'conversion', label, passed, detail, severity, weight };
}

const CTA_WORDS = /(get a quote|request a quote|book now|call now|contact us|get started|free quote|book a|enquire|schedule|get in touch|buy now|order now)/i;

export function runConversionChecks(page: PageData): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText;

  const ctaMatches = text.match(new RegExp(CTA_WORDS.source, 'gi')) || [];
  results.push(check('conv.primaryCta', 'Clear primary call-to-action present', ctaMatches.length >= 1, ctaMatches.length > 0 ? `CTA phrasing found (e.g. "${ctaMatches[0]}")` : 'No clear call-to-action phrasing found on the page', 'critical', 10));

  results.push(check('conv.multipleCtas', 'Call-to-action repeated on page', ctaMatches.length >= 2, `${ctaMatches.length} CTA phrase occurrence(s) found`, 'medium', 5));

  results.push(check('conv.contactForm', 'Contact/enquiry form present', page.forms.length > 0, page.forms.length > 0 ? `${page.forms.length} form(s) found` : 'No forms found on homepage', 'high', 9));

  const hasStickyHint = /position:\s*(sticky|fixed)/i.test(html);
  results.push(check('conv.stickyCta', 'Sticky CTA element detected', hasStickyHint, hasStickyHint ? 'Sticky/fixed-position element detected (may be a sticky CTA)' : 'No sticky/fixed-position elements detected', 'low', 3));

  const hasTrustBadges = /(insured|accredited|guarantee|certified|award|checkatrade|trustpilot|which\?\s*trusted)/i.test(text);
  results.push(check('conv.trustBadges', 'Trust badges near content', hasTrustBadges, hasTrustBadges ? 'Trust/credential keywords found' : 'No trust badge or credential keywords found', 'medium', 5));

  const hasFaq = /frequently asked questions|\bfaqs?\b/i.test(text);
  results.push(check('conv.faqSection', 'FAQ section present', hasFaq, hasFaq ? 'FAQ section reference found' : 'No FAQ section found', 'medium', 4));

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  results.push(check('conv.serviceDescriptions', 'Sufficient page content/detail', wordCount >= 300, `Homepage has approximately ${wordCount} words of visible text`, 'medium', 5));

  return results;
}
