import { SITE_NAME, SITE_URL, BRAND_NAME, BRAND_URL, canonicalUrl } from './site';

type SchemaObject = Record<string, unknown>;

/** Dean Da Dev is the operating business — Growth Audit is one of its products, not a
 * business/location in its own right, so it isn't the Organization entity itself. */
export function buildOrganizationSchema(): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    url: BRAND_URL,
    logo: canonicalUrl('/icon-512.png'),
    sameAs: [SITE_URL],
  };
}

export function buildSoftwareApplicationSchema(): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    description:
      'Free AI-powered website audit covering SEO, performance, accessibility, trust, mobile, conversion and local SEO — plus growth opportunities and recommended web development services to fix them.',
    creator: { '@type': 'Organization', name: BRAND_NAME, url: BRAND_URL },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqSchema(items: FaqItem[]): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface ArticleSchemaInput {
  title: string;
  description: string;
  path: string;
  publishDate: Date;
  updatedDate?: Date;
  authorName: string;
  image?: string;
}

export function buildArticleSchema(input: ArticleSchemaInput): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: canonicalUrl(input.path),
    datePublished: input.publishDate.toISOString(),
    dateModified: (input.updatedDate ?? input.publishDate).toISOString(),
    author: { '@type': 'Person', name: input.authorName },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    ...(input.image ? { image: input.image } : {}),
  };
}
