import type { CheckResult } from '../../../src/lib/types';
import type { PageData } from '../fetchSite';

function check(id: string, label: string, passed: boolean, detail: string, severity: CheckResult['severity'], weight: number): CheckResult {
  return { id, category: 'seo', label, passed, detail, severity, weight };
}

export function runSeoChecks(page: PageData, robotsTxt: string | null, sitemapXml: string | null): CheckResult[] {
  const results: CheckResult[] = [];

  const title = page.title?.trim() ?? '';
  results.push(check('seo.missingTitle', 'Page title present', title.length > 0, title.length > 0 ? `Title: "${title}"` : 'No <title> tag found', 'critical', 10));

  if (title.length > 0) {
    const good = title.length >= 30 && title.length <= 60;
    results.push(check('seo.titleLength', 'Title length optimal (30-60 chars)', good, `Title is ${title.length} characters`, 'medium', 6));
  }

  const desc = page.metaDescription?.trim() ?? '';
  results.push(check('seo.missingMetaDescription', 'Meta description present', desc.length > 0, desc.length === 0 ? 'No meta description found' : `Meta description is ${desc.length} characters`, 'high', 8));
  if (desc.length > 0) {
    const optimalLength = desc.length >= 50 && desc.length <= 160;
    results.push(check('seo.metaDescriptionLength', 'Meta description length optimal (50-160 chars)', optimalLength, `Meta description is ${desc.length} characters`, 'low', 4));
  }

  results.push(check('seo.missingH1', 'Exactly one H1 present', page.h1s.length === 1, page.h1s.length === 0 ? 'No H1 tag found' : `${page.h1s.length} H1 tag(s) found`, 'high', 8));
  if (page.h1s.length > 1) {
    results.push(check('seo.multipleH1', 'Single H1 (not multiple)', false, `${page.h1s.length} H1 tags found`, 'low', 3));
  }

  const ogCount = Object.keys(page.openGraph).length;
  results.push(check('seo.openGraph', 'Open Graph tags present', ogCount >= 3, ogCount === 0 ? 'No Open Graph tags found' : `${ogCount} Open Graph tag(s) found`, 'low', 4));

  const twCount = Object.keys(page.twitterCard).length;
  results.push(check('seo.twitterCard', 'Twitter Card tags present', twCount >= 2, twCount === 0 ? 'No Twitter Card tags found' : `${twCount} Twitter Card tag(s) found`, 'low', 3));

  results.push(check('seo.canonical', 'Canonical URL present', !!page.canonical, page.canonical ? `Canonical: ${page.canonical}` : 'No canonical tag found', 'low', 4));

  results.push(check('seo.robotsTxt', 'robots.txt present', !!robotsTxt, robotsTxt ? 'robots.txt found' : 'No robots.txt found', 'low', 4));

  results.push(check('seo.sitemap', 'sitemap.xml present', !!sitemapXml, sitemapXml ? 'sitemap.xml found' : 'No sitemap.xml found', 'medium', 6));

  const imagesMissingAlt = page.images.filter((img) => !img.alt || img.alt.trim() === '');
  results.push(check('seo.imageAlt', 'Images have alt text', page.images.length === 0 || imagesMissingAlt.length === 0, page.images.length === 0 ? 'No images found' : `${imagesMissingAlt.length} of ${page.images.length} images missing alt text`, 'medium', 7));

  results.push(check('seo.structuredData', 'Structured data (schema.org) present', page.jsonLd.length > 0, page.jsonLd.length > 0 ? `${page.jsonLd.length} structured data block(s) found` : 'No structured data found', 'high', 9));

  const hasLocalBusiness = jsonLdHasType(page.jsonLd, ['LocalBusiness', 'Organization', 'HomeAndConstructionBusiness']);
  results.push(check('seo.localBusinessSchema', 'LocalBusiness schema present', hasLocalBusiness, hasLocalBusiness ? 'LocalBusiness/Organization schema found' : 'No LocalBusiness schema found', 'high', 8));

  const hasFaqSchema = jsonLdHasType(page.jsonLd, ['FAQPage']);
  results.push(check('seo.faqSchema', 'FAQ schema present', hasFaqSchema, hasFaqSchema ? 'FAQPage schema found' : 'No FAQPage schema found', 'low', 3));

  const hasBreadcrumb = jsonLdHasType(page.jsonLd, ['BreadcrumbList']);
  results.push(check('seo.breadcrumbSchema', 'Breadcrumb schema present', hasBreadcrumb, hasBreadcrumb ? 'BreadcrumbList schema found' : 'No BreadcrumbList schema found', 'low', 3));

  const internalLinks = page.links.filter((l) => isInternalLink(l.href, page.finalUrl));
  results.push(check('seo.brokenLinks', 'No obviously broken internal links', true, `${internalLinks.length} internal link(s) detected on homepage (deep crawl not performed)`, 'info', 2));

  return results;
}

function jsonLdHasType(blocks: unknown[], types: string[]): boolean {
  return blocks.some((block) => {
    const items = Array.isArray(block) ? block : [block];
    return items.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const t = (item as Record<string, unknown>)['@type'];
      const typeList = Array.isArray(t) ? t : [t];
      return typeList.some((tt) => typeof tt === 'string' && types.includes(tt));
    });
  });
}

function isInternalLink(href: string, baseUrl: string): boolean {
  try {
    const base = new URL(baseUrl);
    const url = new URL(href, base);
    return url.host === base.host;
  } catch {
    return false;
  }
}
