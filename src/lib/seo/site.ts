export const SITE_NAME = 'AI Website Growth Audit';
export const SITE_URL = (import.meta.env.SITE_URL || 'https://app.dean-da-dev.co.uk').replace(/\/$/, '');
export const SITE_DESCRIPTION =
  'Get a free AI website audit covering SEO, speed, accessibility and conversions, with clear recommendations to help you win more enquiries.';
export const BRAND_NAME = 'Dean Da Dev';
export const BRAND_URL = 'https://dean-da-dev.co.uk';
export const BRAND_EMAIL = 'dean@dean-da-dev.co.uk';
export const CONSULTATION_URL = 'https://www.dean-da-dev.co.uk/DiscoveryCall';
export const PORTFOLIO_URL = 'https://www.dean-da-dev.co.uk/portfolio';

export function canonicalUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}
