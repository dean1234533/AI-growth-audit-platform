import type { CheckResult, MeasurementType } from '../../../lib/types';
import type { PageData } from '../fetchSite';
import type { RenderedPageData } from '../renderPage';
import { hasGoogleLocationLink } from './shared/googleLocationLinks';
import { isSoftwareProductSite } from './shared/siteType';

function notApplicableToSoftware(id: string, label: string): CheckResult {
  return {
    id,
    category: 'trust',
    label,
    passed: true,
    detail: 'Not applicable — this page identifies itself as a software product, not a local business.',
    severity: 'info',
    weight: 0,
    measurementType: 'not_available',
  };
}

function check(
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: CheckResult['severity'],
  weight: number,
  measurementType: MeasurementType = 'detected',
): CheckResult {
  return { id, category: 'trust', label, passed, detail, severity, weight, measurementType };
}

/** A miss that's genuinely unknown rather than confirmed-absent — see CheckStatus in types.ts. */
function notVerified(id: string, label: string, reason: string): CheckResult {
  return { id, category: 'trust', label, passed: true, detail: reason, severity: 'info', weight: 0, measurementType: 'not_available', status: 'not_verified' };
}

const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function runTrustChecks(page: PageData, rendered?: RenderedPageData | null): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText.toLowerCase();
  const isSoftwareProduct = isSoftwareProductSite(page.jsonLd);

  results.push(check('trust.ssl', 'Site served over HTTPS', page.isHttps, page.isHttps ? 'Site uses HTTPS' : 'Site is not served over HTTPS', 'critical', 12));

  const hasPrivacyLink = /privacy[\s-]?policy/i.test(html);
  results.push(check('trust.privacyPolicy', 'Privacy Policy linked', hasPrivacyLink, hasPrivacyLink ? 'Privacy Policy link found' : 'No Privacy Policy link found', 'medium', 5));

  const hasTermsLink =
    /terms[\s-]*(&|and)?[\s-]*conditions|terms[\s-]+of[\s-]+(service|use)/i.test(html) ||
    /href=["'][^"']*\bterms\b[^"']*["']/i.test(html);
  results.push(check('trust.terms', 'Terms & Conditions linked', hasTermsLink, hasTermsLink ? 'Terms link found' : 'No Terms & Conditions link found', 'low', 3));

  const hasContactLink = /href=["'][^"']*contact[^"']*["']/i.test(html) || /contact\s+us/i.test(text);
  results.push(check('trust.contactPage', 'Contact page linked', hasContactLink, hasContactLink ? 'Contact link/page reference found' : 'No contact page link found', 'high', 8));

  if (isSoftwareProduct) {
    results.push(notApplicableToSoftware('trust.phoneNumber', 'Phone number visible'));
  } else {
    const hasPhone = PHONE_REGEX.test(text) || /tel:/i.test(html);
    results.push(check('trust.phoneNumber', 'Phone number visible', hasPhone, hasPhone ? 'Phone number pattern found' : 'No phone number found on homepage', 'high', 8));
  }

  const hasEmail = EMAIL_REGEX.test(text) || /mailto:/i.test(html);
  results.push(check('trust.email', 'Email address visible', hasEmail, hasEmail ? 'Email address found' : 'No email address found on homepage', 'medium', 6));

  if (isSoftwareProduct) {
    results.push(notApplicableToSoftware('trust.googleMaps', 'Google Map embedded'));
  } else {
    // Same detector as local.gbp (localSeo.ts) — the two checks used to maintain separate,
    // divergently-drifted regexes for the same real-world signal.
    const hasMap = hasGoogleLocationLink(html);
    results.push(check('trust.googleMaps', 'Google Map embedded', hasMap, hasMap ? 'Google Maps embed/link found' : 'No Google Maps embed found', 'medium', 5));
  }

  const TESTIMONIAL_PATTERN = /testimonial|review|what our customers|client says|5[\s-]?star/i;
  const staticTestimonialMatch = TESTIMONIAL_PATTERN.test(text);
  if (rendered) {
    // Review widgets/carousels (Trustpilot, Google Reviews, Elfsight, Swiper-based sliders)
    // are overwhelmingly JS-rendered — an empty container in the static HTML is common even
    // on sites that genuinely display testimonials. The rendered page has actually executed
    // that JS, so its visible text is the real source of truth here.
    const hasTestimonials = staticTestimonialMatch || TESTIMONIAL_PATTERN.test(rendered.visibleText);
    results.push(check('trust.testimonials', 'Testimonials or reviews present', hasTestimonials, hasTestimonials ? 'Testimonial/review-related content found' : 'No testimonials or reviews detected after rendering the page', 'high', 9, 'measured'));
  } else if (staticTestimonialMatch) {
    results.push(check('trust.testimonials', 'Testimonials or reviews present', true, 'Testimonial/review-related content found', 'high', 9, 'inferred'));
  } else {
    results.push(notVerified('trust.testimonials', 'Testimonials or reviews present', 'No testimonial/review text found in the static HTML — many review widgets only render after JavaScript runs, so this could not be confirmed absent without browser rendering.'));
  }

  const hasSocialLinks = /(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|tiktok\.com)\//i.test(html);
  results.push(check('trust.socialLinks', 'Social media links present', hasSocialLinks, hasSocialLinks ? 'Social media link(s) found' : 'No social media links found', 'low', 3));

  if (isSoftwareProduct) {
    results.push(notApplicableToSoftware('trust.businessHours', 'Business hours listed'));
  } else {
    const hasHoursText = /(monday|mon)[\s-]*(to|-)?\s*(friday|fri)|opening hours|business hours|\b\d{1,2}(am|pm)\s*-\s*\d{1,2}(am|pm)/i.test(text);
    const hasHoursSchema = jsonLdHasOpeningHours(page.jsonLd);
    const hasHours = hasHoursText || hasHoursSchema;
    results.push(
      check(
        'trust.businessHours',
        'Business hours listed',
        hasHours,
        hasHours ? (hasHoursSchema ? 'openingHoursSpecification found in structured data' : 'Business hours pattern found in page text') : 'No business hours found',
        'medium',
        4,
      ),
    );
  }

  // Cookie banners are almost always injected by a third-party consent-management script
  // (Cookiebot, OneTrust, CookieYes) — the static HTML only ever contains the *loader* script
  // tag, not the actual banner markup, so a text match here is really guessing based on script
  // presence. The rendered page has that script's actual output.
  const STATIC_COOKIE_HINT = /cookie/i.test(html) && /(consent|accept|banner)/i.test(html);
  if (rendered) {
    const renderedHasBanner = /cookie/i.test(rendered.visibleText) && /(consent|accept|manage preferences)/i.test(rendered.visibleText);
    const hasCookieBanner = STATIC_COOKIE_HINT || renderedHasBanner;
    results.push(check('trust.cookieBanner', 'Cookie consent present', hasCookieBanner, hasCookieBanner ? 'Cookie consent banner found' : 'No cookie consent banner detected after rendering the page', 'low', 2, 'measured'));
  } else if (STATIC_COOKIE_HINT) {
    results.push(check('trust.cookieBanner', 'Cookie consent present', true, 'Cookie consent references found in the static HTML', 'low', 2, 'inferred'));
  } else {
    results.push(notVerified('trust.cookieBanner', 'Cookie consent present', 'No cookie-consent references found in the static HTML — most consent banners are injected by a third-party script after JavaScript runs, so this could not be confirmed absent without browser rendering.'));
  }

  const headers = page.headers;
  const hasHeader = (name: string) => !!headers[name];

  results.push(check('trust.hsts', 'Strict-Transport-Security header set', hasHeader('strict-transport-security'), hasHeader('strict-transport-security') ? `Set: ${headers['strict-transport-security']}` : 'No Strict-Transport-Security header found', 'high', 6));

  results.push(check('trust.csp', 'Content-Security-Policy header set', hasHeader('content-security-policy'), hasHeader('content-security-policy') ? 'Content-Security-Policy header present' : 'No Content-Security-Policy header found', 'medium', 5));

  const hasFrameProtection = hasHeader('x-frame-options') || /frame-ancestors/i.test(headers['content-security-policy'] ?? '');
  results.push(check('trust.frameProtection', 'Clickjacking protection (X-Frame-Options/CSP frame-ancestors)', hasFrameProtection, hasFrameProtection ? 'Frame protection header found' : 'No X-Frame-Options or CSP frame-ancestors directive found', 'medium', 5));

  results.push(check('trust.contentTypeOptions', 'X-Content-Type-Options header set', hasHeader('x-content-type-options'), hasHeader('x-content-type-options') ? `Set: ${headers['x-content-type-options']}` : 'No X-Content-Type-Options header found', 'low', 3));

  results.push(check('trust.referrerPolicy', 'Referrer-Policy header set', hasHeader('referrer-policy'), hasHeader('referrer-policy') ? `Set: ${headers['referrer-policy']}` : 'No Referrer-Policy header found', 'low', 3));

  results.push(check('trust.permissionsPolicy', 'Permissions-Policy header set', hasHeader('permissions-policy'), hasHeader('permissions-policy') ? 'Permissions-Policy header present' : 'No Permissions-Policy header found', 'low', 2));

  if (page.isHttps) {
    const mixedContentMatches = [...html.matchAll(/(?:src|href)=["']http:\/\/[^"']+["']/gi)];
    const hasMixedContent = mixedContentMatches.length > 0;
    results.push(check('trust.mixedContent', 'No mixed content (insecure http:// resources)', !hasMixedContent, hasMixedContent ? `${mixedContentMatches.length} resource(s) loaded over insecure http:// on an https page` : 'No insecure http:// resource references found', 'high', 7));
  }

  return results;
}

/** Recursively searches parsed JSON-LD for an OpeningHoursSpecification block or key, at any nesting depth. */
function jsonLdHasOpeningHours(blocks: unknown[]): boolean {
  return blocks.some((block) => containsOpeningHours(block));
}

function containsOpeningHours(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsOpeningHours(item, depth + 1));

  const obj = value as Record<string, unknown>;
  if ('openingHoursSpecification' in obj || 'openingHours' in obj) return true;
  const type = obj['@type'];
  const typeList = Array.isArray(type) ? type : [type];
  if (typeList.some((t) => typeof t === 'string' && t === 'OpeningHoursSpecification')) return true;

  return Object.values(obj).some((v) => containsOpeningHours(v, depth + 1));
}
