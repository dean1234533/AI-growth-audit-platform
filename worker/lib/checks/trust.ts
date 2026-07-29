import type { CheckResult } from '../../../src/lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'trust', label, passed, detail, severity, weight };
}

const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function runTrustChecks(page: PageData): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText.toLowerCase();

  results.push(check('trust.ssl', 'Site served over HTTPS', page.isHttps, page.isHttps ? 'Site uses HTTPS' : 'Site is not served over HTTPS', 'critical', 12));

  const hasPrivacyLink = /privacy[\s-]?policy/i.test(html);
  results.push(check('trust.privacyPolicy', 'Privacy Policy linked', hasPrivacyLink, hasPrivacyLink ? 'Privacy Policy link found' : 'No Privacy Policy link found', 'medium', 5));

  const hasTermsLink = /terms\s*(&|and)?\s*conditions|terms\s+of\s+(service|use)/i.test(html);
  results.push(check('trust.terms', 'Terms & Conditions linked', hasTermsLink, hasTermsLink ? 'Terms link found' : 'No Terms & Conditions link found', 'low', 3));

  const hasContactLink = /href=["'][^"']*contact[^"']*["']/i.test(html) || /contact\s+us/i.test(text);
  results.push(check('trust.contactPage', 'Contact page linked', hasContactLink, hasContactLink ? 'Contact link/page reference found' : 'No contact page link found', 'high', 8));

  const hasPhone = PHONE_REGEX.test(text) || /tel:/i.test(html);
  results.push(check('trust.phoneNumber', 'Phone number visible', hasPhone, hasPhone ? 'Phone number pattern found' : 'No phone number found on homepage', 'high', 8));

  const hasEmail = EMAIL_REGEX.test(text) || /mailto:/i.test(html);
  results.push(check('trust.email', 'Email address visible', hasEmail, hasEmail ? 'Email address found' : 'No email address found on homepage', 'medium', 6));

  const hasMap = /maps\.google|google\.com\/maps|maps\.app\.goo\.gl/i.test(html);
  results.push(check('trust.googleMaps', 'Google Map embedded', hasMap, hasMap ? 'Google Maps embed/link found' : 'No Google Maps embed found', 'medium', 5));

  const hasTestimonials = /testimonial|review|what our customers|client says|5[\s-]?star/i.test(text);
  results.push(check('trust.testimonials', 'Testimonials or reviews present', hasTestimonials, hasTestimonials ? 'Testimonial/review-related content found' : 'No testimonials or reviews detected', 'high', 9));

  const hasSocialLinks = /(facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|tiktok\.com)\//i.test(html);
  results.push(check('trust.socialLinks', 'Social media links present', hasSocialLinks, hasSocialLinks ? 'Social media link(s) found' : 'No social media links found', 'low', 3));

  const hasHours = /(monday|mon)[\s-]*(to|-)?\s*(friday|fri)|opening hours|business hours|\b\d{1,2}(am|pm)\s*-\s*\d{1,2}(am|pm)/i.test(text);
  results.push(check('trust.businessHours', 'Business hours listed', hasHours, hasHours ? 'Business hours pattern found' : 'No business hours found', 'medium', 4));

  const hasCookieBanner = /cookie/i.test(html) && /(consent|accept|banner)/i.test(html);
  results.push(check('trust.cookieBanner', 'Cookie consent present', hasCookieBanner, hasCookieBanner ? 'Cookie consent references found' : 'No cookie consent banner detected', 'low', 2));

  return results;
}
