import type { CheckResult } from '../../../src/lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'localSeo', label, passed, detail, severity, weight };
}

export function runLocalSeoChecks(page: PageData): CheckResult[] {
  const results: CheckResult[] = [];
  const html = page.html;
  const text = page.bodyText;

  const hasGbp = /g\.page\/|goo\.gl\/maps|maps\.google|google\.com\/maps\/place|business\.google\.com/i.test(html);
  results.push(check('local.gbp', 'Google Business Profile linked', hasGbp, hasGbp ? 'Google Business Profile / Maps link found' : 'No Google Business Profile link found', 'high', 9));

  const hasAddressPattern = /\b\d{1,5}\s+[A-Za-z][A-Za-z\s]{2,30}(street|st|road|rd|avenue|ave|lane|ln|drive|dr)\b/i.test(text) || /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/.test(text);
  results.push(check('local.nap', 'Name/Address/Phone consistently present', hasAddressPattern, hasAddressPattern ? 'Address-like pattern found on page' : 'No clear address pattern found on homepage', 'medium', 6));

  const hasLocationPages = /href=["'][^"']*(locations?|areas?-we-cover|service-area)[^"']*["']/i.test(html);
  results.push(check('local.locationPages', 'Dedicated location/service-area pages', hasLocationPages, hasLocationPages ? 'Location/service-area page link found' : 'No dedicated location pages found', 'high', 7));

  const hasServiceAreas = /(serving|we cover|service area|areas we serve|based in)/i.test(text);
  results.push(check('local.serviceAreas', 'Service areas listed', hasServiceAreas, hasServiceAreas ? 'Service-area phrasing found' : 'No service-area phrasing found', 'medium', 5));

  const hasReviewCount = /\b\d+(\.\d)?\s*\/\s*5\b|\b\d+\s*(reviews|ratings)\b|★{3,}/i.test(text);
  results.push(check('local.reviews', 'Review count/rating displayed', hasReviewCount, hasReviewCount ? 'Review/rating pattern found' : 'No review count or rating displayed on homepage', 'high', 8));

  return results;
}
