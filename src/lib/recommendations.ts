import type { CheckResult, Recommendation, Severity } from './types';

interface RecommendationRule {
  title: (detail: string) => string;
  description: (detail: string) => string;
  impact: Recommendation['impact'];
  difficulty: Recommendation['difficulty'];
  estimatedTime: string;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const IMPACT_WEIGHT: Record<Recommendation['impact'], number> = { high: 3, medium: 2, low: 1 };

/**
 * Deterministic fallback text per check id, used if AI narrative generation
 * is unavailable, and as the base the AI rewrites from.
 */
const RULES: Record<string, RecommendationRule> = {
  'seo.missingTitle': {
    title: () => 'Add a page title',
    description: () => 'Your homepage has no <title> tag, which search engines rely on heavily to understand and rank the page.',
    impact: 'high', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'seo.titleLength': {
    title: (d) => `Fix your title length (${d})`,
    description: (d) => `Your page title is ${d}. Titles outside the 30-60 character range often get truncated in search results or fail to communicate value.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'seo.missingMetaDescription': {
    title: () => 'Add a meta description',
    description: () => 'No meta description was found. This is the summary text shown under your listing in Google search results, and its absence hurts click-through rate.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'seo.metaDescriptionLength': {
    title: (d) => `Fine-tune your meta description length (${d})`,
    description: (d) => `Your meta description is ${d}. Descriptions outside the 50-160 character range often get truncated in search results or waste the space Google gives you.`,
    impact: 'low', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'seo.missingH1': {
    title: () => 'Add a single clear H1 heading',
    description: () => 'Your homepage has no H1 tag. Search engines use the H1 to understand the primary topic of the page.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'seo.multipleH1': {
    title: (d) => `Reduce multiple H1 tags (${d})`,
    description: (d) => `Your page has ${d}. Having more than one H1 can dilute topical relevance for search engines.`,
    impact: 'low', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'seo.openGraph': {
    title: () => 'Add Open Graph tags',
    description: () => 'No Open Graph tags were detected, so links to your site on Facebook, LinkedIn and messaging apps will show a blank or broken preview.',
    impact: 'low', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'seo.twitterCard': {
    title: () => 'Add Twitter Card tags',
    description: () => 'No Twitter Card meta tags were found, so shared links on X/Twitter will not display a rich preview.',
    impact: 'low', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'seo.canonical': {
    title: () => 'Add a canonical URL',
    description: () => 'No canonical tag was found, which can cause duplicate-content issues if the site is reachable via multiple URLs.',
    impact: 'low', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'seo.robotsTxt': {
    title: () => 'Add a robots.txt file',
    description: () => 'No robots.txt was found at the root of your domain. Without it, search engines fall back to default crawling behaviour which may not suit your site.',
    impact: 'low', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'seo.sitemap': {
    title: () => 'Add an XML sitemap',
    description: () => 'No sitemap.xml was found. A sitemap helps search engines discover and index all of your pages faster.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '30 minutes',
  },
  'seo.imageAlt': {
    title: (d) => `Add alt text to images (${d})`,
    description: (d) => `${d}. Missing alt text hurts both SEO and accessibility.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'seo.structuredData': {
    title: () => 'Add structured data (schema.org)',
    description: () => 'No structured data was detected on your homepage. Structured data helps Google show rich results (star ratings, FAQs, business info) that increase click-through rate.',
    impact: 'high', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'seo.localBusinessSchema': {
    title: () => 'Add LocalBusiness schema',
    description: () => 'No LocalBusiness structured data was found. This markup helps Google understand your business name, address, phone number and hours for local search results.',
    impact: 'high', difficulty: 'medium', estimatedTime: '1 hour',
  },
  'seo.faqSchema': {
    title: () => 'Add FAQ schema',
    description: () => 'No FAQ structured data was found. If you have an FAQ section, marking it up can earn extra visible space in Google search results.',
    impact: 'low', difficulty: 'medium', estimatedTime: '45 minutes',
  },
  'seo.breadcrumbSchema': {
    title: () => 'Add breadcrumb schema',
    description: () => 'No breadcrumb structured data was found, which can help Google display a cleaner navigation path in search results.',
    impact: 'low', difficulty: 'medium', estimatedTime: '45 minutes',
  },
  'seo.brokenLinks': {
    title: (d) => `Fix broken internal links (${d})`,
    description: (d) => `${d} on your homepage. Broken links hurt user trust and waste crawl budget.`,
    impact: 'medium', difficulty: 'medium', estimatedTime: '30-60 minutes',
  },
  'seo.duplicateTitle': {
    title: () => 'Fix duplicate page titles',
    description: () => 'Multiple pages appear to share the same title tag, which makes it harder for search engines to differentiate them in results.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '30 minutes',
  },
  'perf.largeImages': {
    title: (d) => `Compress large images (${d})`,
    description: (d) => `${d}. Large, unoptimised images are one of the most common causes of slow page loads.`,
    impact: 'high', difficulty: 'easy', estimatedTime: '30-60 minutes',
  },
  'perf.unusedCss': {
    title: () => 'Remove unused CSS',
    description: () => 'A significant amount of unused CSS is being loaded on this page, delaying render.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'perf.unusedJs': {
    title: () => 'Remove unused JavaScript',
    description: () => 'A significant amount of unused JavaScript is being shipped to visitors, increasing load and parse time.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'perf.compression': {
    title: () => 'Enable text compression',
    description: () => 'Text-based resources (HTML/CSS/JS) are not being served with gzip or brotli compression, increasing transfer size unnecessarily.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'perf.caching': {
    title: () => 'Set up browser caching',
    description: () => 'Static assets are missing efficient cache headers, forcing repeat visitors to re-download them.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'perf.lazyLoading': {
    title: () => 'Lazy-load offscreen images',
    description: () => 'Images below the fold are loading immediately instead of lazily, competing with critical content for bandwidth.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'perf.renderBlocking': {
    title: (d) => `Eliminate render-blocking resources (${d})`,
    description: (d) => `${d} are blocking the page from rendering quickly.`,
    impact: 'high', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'perf.lcp': {
    title: (d) => `Improve Largest Contentful Paint (${d})`,
    description: (d) => `LCP is ${d}. This measures how fast your main content appears, and is a direct Google ranking factor.`,
    impact: 'high', difficulty: 'medium', estimatedTime: '1-3 hours',
  },
  'perf.cls': {
    title: (d) => `Fix layout shift (${d})`,
    description: (d) => `Cumulative Layout Shift is ${d}. Elements are moving around as the page loads, which frustrates visitors and hurts rankings.`,
    impact: 'medium', difficulty: 'medium', estimatedTime: '1 hour',
  },
  'perf.inp': {
    title: (d) => `Improve interaction responsiveness (${d})`,
    description: (d) => `Interaction to Next Paint is ${d}. Slow response to clicks/taps makes the site feel sluggish.`,
    impact: 'medium', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'a11y.contrast': {
    title: (d) => `Fix low colour contrast (${d})`,
    description: (d) => `${d}. Low contrast text is hard to read for many visitors, particularly on mobile in bright light.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'a11y.ariaLabels': {
    title: (d) => `Add missing ARIA labels (${d})`,
    description: (d) => `${d}. Screen reader users cannot tell what these controls do without a label.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'a11y.formLabels': {
    title: (d) => `Add labels to form fields (${d})`,
    description: (d) => `${d}. Unlabelled form fields are a major barrier for assistive technology users, and often for autofill too.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'a11y.imageAlt': {
    title: (d) => `Add missing alt text (${d})`,
    description: (d) => `${d}. Screen readers cannot describe these images to visually impaired visitors.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'a11y.headingHierarchy': {
    title: () => 'Fix heading hierarchy',
    description: () => 'Heading levels skip or are out of order, which disorients screen reader users navigating by heading.',
    impact: 'low', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'a11y.buttonAccessible': {
    title: (d) => `Fix inaccessible buttons (${d})`,
    description: (d) => `${d}. Buttons without accessible names cannot be used by screen reader visitors.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'a11y.focusStates': {
    title: () => 'Add visible focus states',
    description: () => 'Interactive elements have no visible focus outline, making keyboard navigation very difficult to follow.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'mobile.viewport': {
    title: () => 'Add a mobile viewport tag',
    description: () => 'No viewport meta tag was found, so mobile browsers will render a desktop-width layout and force users to pinch-zoom.',
    impact: 'high', difficulty: 'easy', estimatedTime: '5 minutes',
  },
  'mobile.responsive': {
    title: () => 'Fix responsive layout issues',
    description: () => 'The page does not appear to adapt its layout for smaller screens, which is where most visitors will land.',
    impact: 'high', difficulty: 'hard', estimatedTime: '1+ days',
  },
  'mobile.touchTargets': {
    title: (d) => `Enlarge touch targets (${d})`,
    description: (d) => `${d}. Small tap targets cause mis-taps and frustration on mobile devices.`,
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'mobile.textSizing': {
    title: () => 'Fix small text on mobile',
    description: () => 'Base font size is too small to read comfortably on mobile without zooming.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'trust.ssl': {
    title: () => 'Install an SSL certificate',
    description: () => 'Your site is not being served over HTTPS. Browsers actively warn visitors that the site is "Not Secure", which destroys trust instantly.',
    impact: 'high', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'trust.privacyPolicy': {
    title: () => 'Add a Privacy Policy page',
    description: () => 'No Privacy Policy was found. This is expected by visitors and often legally required.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '1 hour',
  },
  'trust.terms': {
    title: () => 'Add Terms & Conditions',
    description: () => 'No Terms & Conditions page was found on the site.',
    impact: 'low', difficulty: 'easy', estimatedTime: '1 hour',
  },
  'trust.contactPage': {
    title: () => 'Add a dedicated contact page',
    description: () => 'No clear contact page was found. Visitors and Google both use this as a trust signal for legitimacy.',
    impact: 'high', difficulty: 'easy', estimatedTime: '1 hour',
  },
  'trust.phoneNumber': {
    title: () => 'Display a phone number',
    description: () => 'No phone number was found anywhere on the homepage. Many local customers still prefer to call before enquiring.',
    impact: 'high', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'trust.email': {
    title: () => 'Display a contact email address',
    description: () => 'No email address was found on the homepage, removing an easy low-friction way for visitors to reach you.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'trust.googleMaps': {
    title: () => 'Embed a Google Map',
    description: () => 'No embedded map was found. For a local business, showing your location builds trust and helps local search relevance.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'trust.testimonials': {
    title: () => 'Add customer testimonials',
    description: () => 'No testimonials or reviews were detected on the homepage. Social proof is one of the strongest conversion drivers for service businesses.',
    impact: 'high', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'trust.socialLinks': {
    title: () => 'Add social media links',
    description: () => 'No links to social media profiles were found, missing an easy trust and engagement signal.',
    impact: 'low', difficulty: 'easy', estimatedTime: '15 minutes',
  },
  'trust.businessHours': {
    title: () => 'Display business hours',
    description: () => 'No business hours were found on the page. Visitors often check this before calling or visiting.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '10 minutes',
  },
  'trust.cookieBanner': {
    title: () => 'Add a cookie consent banner',
    description: () => 'No cookie consent mechanism was detected. This may be a compliance risk depending on your analytics/tracking usage and target regions.',
    impact: 'low', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'conv.primaryCta': {
    title: () => 'Add a clear primary call-to-action',
    description: () => 'No obvious primary call-to-action (e.g. "Get a Quote", "Call Now") was found above the fold. Visitors should never have to hunt for what to do next.',
    impact: 'high', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'conv.multipleCtas': {
    title: () => 'Repeat your call-to-action down the page',
    description: () => 'Only one call-to-action was found on the page. Repeating it at natural decision points increases the chance a visitor converts.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'conv.contactForm': {
    title: () => 'Add a contact/enquiry form',
    description: () => 'No contact form was detected. Not every visitor wants to call or email directly — a form lowers the barrier to enquire.',
    impact: 'high', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'conv.stickyCta': {
    title: () => 'Add a sticky call-to-action on mobile',
    description: () => 'The call-to-action scrolls out of view on mobile. A sticky "Call" or "Get Quote" bar keeps the action always reachable.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '1 hour',
  },
  'conv.trustBadges': {
    title: () => 'Add trust badges near your CTA',
    description: () => 'No trust badges (accreditations, guarantees, insurance) were found near the call-to-action to reassure hesitant visitors.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '30 minutes',
  },
  'conv.faqSection': {
    title: () => 'Add an FAQ section',
    description: () => 'No FAQ section was found. Answering common objections on-page reduces hesitation before enquiring.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'conv.serviceDescriptions': {
    title: () => 'Expand your service descriptions',
    description: () => 'Service descriptions on the homepage are very brief. Visitors need enough detail to trust you understand their specific need.',
    impact: 'medium', difficulty: 'medium', estimatedTime: '1-2 hours',
  },
  'local.gbp': {
    title: () => 'Link your Google Business Profile',
    description: () => 'No link or reference to a Google Business Profile was found. This is one of the highest-impact things for local search visibility.',
    impact: 'high', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'local.nap': {
    title: () => 'Keep your name, address & phone consistent',
    description: () => 'Business name, address or phone number could not be reliably detected in consistent text on the page, which can hurt local search trust.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'local.locationPages': {
    title: () => 'Add dedicated location/service-area pages',
    description: () => 'No dedicated location or service-area pages were found. These help you rank for "near me" and location-specific searches.',
    impact: 'high', difficulty: 'hard', estimatedTime: '1+ days',
  },
  'local.serviceAreas': {
    title: () => 'List your service areas clearly',
    description: () => 'No clear list of the towns/regions you serve was found on the page.',
    impact: 'medium', difficulty: 'easy', estimatedTime: '20 minutes',
  },
  'local.reviews': {
    title: () => 'Display Google reviews on-page',
    description: () => 'No Google review count or rating was found displayed on the site, missing a strong local trust signal.',
    impact: 'high', difficulty: 'medium', estimatedTime: '1 hour',
  },
};

export function buildRecommendations(failedChecks: CheckResult[]): Recommendation[] {
  const recs = failedChecks.map((check) => {
    const rule = RULES[check.id];
    const title = rule ? rule.title(check.detail) : check.label;
    const description = rule ? rule.description(check.detail) : check.detail;
    const impact = rule?.impact ?? 'medium';
    const difficulty = rule?.difficulty ?? 'medium';
    const estimatedTime = rule?.estimatedTime ?? '30-60 minutes';
    const priority = SEVERITY_WEIGHT[check.severity] * 10 + IMPACT_WEIGHT[impact];

    const rec: Recommendation = {
      id: check.id,
      category: check.category,
      title,
      description,
      severity: check.severity,
      impact,
      difficulty,
      estimatedTime,
      priority,
      aiGenerated: false,
    };
    return rec;
  });

  return recs.sort((a, b) => b.priority - a.priority);
}
