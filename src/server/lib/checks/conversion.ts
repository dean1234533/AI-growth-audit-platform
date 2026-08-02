import type { CheckResult, MeasurementType } from '../../../lib/types';
import type { PageData } from '../fetchSite';
import type { RenderedPageData } from '../renderPage';
import { isSoftwareProductSite } from './shared/siteType';

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType = 'detected',
): CheckResult {
  return { id, category: 'conversion', label, passed, detail, severity, weight, measurementType };
}

/** A miss that's genuinely unknown rather than confirmed-absent — see CheckStatus in types.ts. */
function notVerified(id: string, label: string, reason: string): CheckResult {
  return { id, category: 'conversion', label, passed: true, detail: reason, severity: 'info', weight: 0, measurementType: 'not_available', status: 'not_verified' };
}

const CTA_WORDS =
  /(get a quote|request a quote|book now|call now|contact us|get started|free quote|book a|enquire|schedule|get in touch|buy now|order now|message us|chat with us|start your project|speak to|try (it )?free|try for free|start free|sign up free|sign up|start your free trial|analyse my|analyze my|get my free|start scanning|no credit card required)/i;

const TRUST_BADGE_WORDS =
  /(insured|accredited|guarantee|certified|award|checkatrade|trustpilot|which\?\s*trusted|feefo|iso\s?\d{4,5}|gas safe|niceic|federation of master builders|\bfmb\b|trustmark|no credit card|cancel anytime|money[- ]back|trusted by|gdpr|soc\s?2|data protection)/i;

const BOOKING_PROVIDERS = /(calendly\.com|acuityscheduling\.com|setmore\.com|book\.squareup\.com|square\.site|housecallpro\.com|getjobber\.com|vagaro\.com|fresha\.com|simplybook\.me|bookings\.microsoft\.com)/i;
// Caught live in remote testing: "Book a discovery call" (a real, working booking flow) didn't
// match any of the original phrases — none of them cover the generic "book a <noun>" pattern
// that's extremely common for consultation/call-booking CTAs specifically (as opposed to
// physical-appointment booking, which tends to use the "book an appointment" phrasing already
// covered). This check is low-weight/informational, so the wider net is an acceptable trade.
const BOOKING_LANGUAGE = /(book now|book online|book an appointment|book a call|book a demo|book a consultation|book a discovery|make a booking|schedule a|request an appointment|get an appointment|check availability|discovery call)/i;

export function runConversionChecks(page: PageData, rendered?: RenderedPageData | null): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText;

  // Prefer rendered visible text/DOM where available — it reflects what a visitor actually
  // sees (JS-rendered content, and excludes anything hidden via display:none/visibility) —
  // rather than raw static text, which both misses JS-rendered copy and can't tell hidden
  // markup apart from visible.
  const effectiveText = rendered?.visibleText || text;
  const visibleButtonTexts = rendered ? rendered.buttons.filter((b) => b.visible).map((b) => b.text) : [];
  const visibleLinkTexts = rendered ? rendered.links.map((l) => l.text) : [];
  const ctaCandidateText = rendered ? `${effectiveText} ${visibleButtonTexts.join(' ')} ${visibleLinkTexts.join(' ')}` : text;

  const ctaMatches = ctaCandidateText.match(new RegExp(CTA_WORDS.source, 'gi')) || [];
  results.push(check('conv.primaryCta', 'Clear primary call-to-action present', ctaMatches.length >= 1, ctaMatches.length > 0 ? `CTA phrasing found (e.g. "${ctaMatches[0]}")` : 'No clear call-to-action phrasing found on the page', 'critical', 10, rendered ? 'measured' : 'detected'));

  results.push(check('conv.multipleCtas', 'Call-to-action repeated on page', ctaMatches.length >= 2, `${ctaMatches.length} CTA phrase occurrence(s) found`, 'medium', 5, rendered ? 'measured' : 'detected'));

  const formCount = rendered ? rendered.forms.length : page.forms.length;
  results.push(check('conv.contactForm', 'Contact/enquiry form present', formCount > 0, formCount > 0 ? `${formCount} form(s) found` : 'No forms found on homepage', 'high', 9, rendered ? 'measured' : 'detected'));

  if (rendered) {
    // Real computed position + on-screen bounding box, not a regex over inline style/<style>
    // text — that missed the overwhelmingly common case of position:sticky/fixed declared in
    // an external stylesheet, and had no concept of whether the element was actually visible.
    const stickyEls = rendered.stickyOrFixedElements;
    const hasSticky = stickyEls.length > 0;
    results.push(
      check(
        'conv.stickyCta',
        'Sticky CTA element detected',
        hasSticky,
        hasSticky ? `${stickyEls.length} sticky/fixed element(s) found on screen (e.g. "${stickyEls[0].text.slice(0, 60)}")` : 'No sticky/fixed-position elements detected on the rendered page',
        'low',
        3,
        'measured',
      ),
    );
  } else {
    results.push(notVerified('conv.stickyCta', 'Sticky CTA element detected', 'Sticky/fixed positioning is almost always declared in an external stylesheet, which this scan could not fetch and render — could not be confirmed either way without browser rendering.'));
  }

  const hasTrustBadges = TRUST_BADGE_WORDS.test(effectiveText);
  results.push(check('conv.trustBadges', 'Trust badges near content', hasTrustBadges, hasTrustBadges ? 'Trust/credential keywords found' : 'No trust badge or credential keywords found', 'medium', 5));

  const hasFaq = /frequently asked questions|\bfaqs?\b|common questions/i.test(effectiveText);
  results.push(check('conv.faqSection', 'FAQ section present', hasFaq, hasFaq ? 'FAQ section reference found' : 'No FAQ section found', 'medium', 4));

  const wordCount = effectiveText.split(/\s+/).filter(Boolean).length;
  results.push(check('conv.serviceDescriptions', 'Sufficient page content/detail', wordCount >= 300, `Homepage has approximately ${wordCount} words of visible text`, 'medium', 5, rendered ? 'measured' : 'detected'));

  const hasWhatsApp = /(wa\.me\/|api\.whatsapp\.com)/i.test(html) || (rendered?.links.some((l) => /(wa\.me\/|api\.whatsapp\.com)/i.test(l.href)) ?? false);
  results.push(check('conv.whatsapp', 'WhatsApp contact link present', hasWhatsApp, hasWhatsApp ? 'WhatsApp link found' : 'No WhatsApp link found — informational, not all businesses need one', 'info', 2));

  const staticBookingSignal = BOOKING_PROVIDERS.test(html);
  const languageBookingSignal = BOOKING_LANGUAGE.test(ctaCandidateText);
  if (rendered) {
    const hasBookingLink = staticBookingSignal || languageBookingSignal;
    results.push(check('conv.bookingLink', 'Online booking link present', hasBookingLink, hasBookingLink ? 'Booking/scheduling link or button found' : 'No booking/scheduling tool found — informational, not all businesses need one', 'info', 2, 'measured'));
  } else if (staticBookingSignal) {
    results.push(check('conv.bookingLink', 'Online booking link present', true, 'Booking/scheduling link found', 'info', 2, 'detected'));
  } else {
    results.push(notVerified('conv.bookingLink', 'Online booking link present', 'Booking functionality may exist but could not be confidently verified — many booking widgets load via JavaScript on a custom domain, which this scan could not render.'));
  }

  if (isSoftwareProductSite(page.jsonLd)) {
    results.push({
      id: 'conv.phoneCta',
      category: 'conversion',
      label: 'Click-to-call phone link present',
      passed: true,
      detail: 'Not applicable — this page identifies itself as a software product, not a phone-based local business.',
      severity: 'info',
      weight: 0,
      measurementType: 'not_available',
    });
  } else {
    const hasPhoneCta = /href=["']tel:/i.test(html) || (rendered?.links.some((l) => l.href.toLowerCase().startsWith('tel:')) ?? false);
    results.push(check('conv.phoneCta', 'Click-to-call phone link present', hasPhoneCta, hasPhoneCta ? 'A tel: link was found — visitors can call directly from mobile' : 'No tel: link found — mobile visitors can\'t tap-to-call', 'high', 6));
  }

  const hasPricingInfo = /£\d|\$\d|€\d|\bfrom\s+£|\bpricing\b|\bprice list\b/i.test(effectiveText) || /href=["'][^"']*pric(e|ing)[^"']*["']/i.test(html);
  results.push(check('conv.pricingInfo', 'Pricing information visible or linked', hasPricingInfo, hasPricingInfo ? 'Pricing signals found on the page' : 'No pricing information or pricing page found — this is often a source of friction before enquiry', 'medium', 5));

  return results;
}
