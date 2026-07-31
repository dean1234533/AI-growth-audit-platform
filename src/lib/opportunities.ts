import type { CategoryId, Recommendation } from './types';
import { CATEGORY_LABELS } from './types';

export interface GrowthOpportunity {
  id: string;
  technicalIssue: string;
  businessOpportunity: string;
  category: CategoryId;
  severity: Recommendation['severity'];
}

/**
 * Business-framed opportunity copy for the highest-signal check ids — evidence-based, not
 * generic. Anything not listed here falls back to a category-derived template rather than
 * being invented.
 */
const OPPORTUNITY_COPY: Record<string, string> = {
  'perf.lcp': 'A faster-loading homepage reduces mobile abandonment and improves first impressions.',
  'perf.pageWeight': 'Trimming page weight speeds up the site for visitors on slower mobile connections.',
  'perf.largeImages': 'Optimised images load faster, which can reduce bounce rate before visitors even see your offer.',
  'local.locationPages': 'Dedicated pages for the areas you serve can capture nearby "near me" and local searches you\'re currently missing.',
  'local.gbp': 'Linking your Google Business Profile helps local searchers find and trust you before they even reach the site.',
  'local.nap': 'Consistent address details help Google confidently show your business in local search results.',
  'local.reviews': 'Displaying reviews/ratings builds trust at the exact moment a visitor is deciding whether to enquire.',
  'local.schemaCompleteness': 'A complete LocalBusiness listing helps you show up correctly in local and map search results.',
  'conv.primaryCta': 'A clear call-to-action gives visitors an obvious next step instead of leaving them to work it out.',
  'conv.contactForm': 'An enquiry form lets visitors reach you without picking up the phone — capturing leads who\'d otherwise leave.',
  'conv.bookingLink': 'Online booking lets customers enquire or book outside business hours, without needing to call.',
  'conv.phoneCta': 'A tap-to-call link turns a mobile visit into a phone enquiry in one tap.',
  'conv.pricingInfo': 'Visible pricing reduces friction — many visitors won\'t enquire at all if cost feels hidden.',
  'conv.faqSection': 'An FAQ section can pre-answer objections that would otherwise stop someone enquiring.',
  'conv.trustBadges': 'Visible credentials near your offer can reassure a hesitant visitor into enquiring.',
  'trust.ssl': 'A secure connection removes a browser warning that can silently scare visitors away.',
  'trust.testimonials': 'Testimonials from real customers build the confidence needed to convert a browser into an enquiry.',
  'trust.socialLinks': 'Linking active social profiles gives visitors another way to verify you\'re a real, active business.',
  'trust.privacyPolicy': 'A privacy policy is often expected before a visitor will trust you with their contact details.',
  'seo.missingTitle': 'A proper page title improves how — and whether — your business shows up in Google search results.',
  'seo.missingMetaDescription': 'A written meta description gives you control over your search-result snippet instead of Google guessing.',
  'seo.imageAlt': 'Image alt text can help your images surface in Google Image search, a source of extra visibility.',
  'seo.structuredData': 'Structured data helps Google understand your business, which can unlock richer search listings.',
  'seo.brokenLinks': 'Fixing broken links keeps visitors moving through your site instead of hitting dead ends.',
  'local.locationRelevance': 'Mentioning your location in the title/meta/H1 sharpens relevance for local searches in that area.',
  'a11y.imageAlt': 'Accessible images widen your reach to visitors using screen readers, and can support SEO too.',
  'a11y.contrast': 'Better contrast makes your content easier to read for every visitor, not just those with visual impairments.',
  'mobile.horizontalOverflow': 'Fixing layout overflow prevents an awkward, unprofessional first impression on mobile.',
};

const CATEGORY_FALLBACK: Record<CategoryId, string> = {
  seo: 'Improving this can help more of the right people find your business in search.',
  performance: 'A faster site keeps more visitors around long enough to see what you offer.',
  accessibility: 'Fixing this makes your site usable by more visitors, and signals a well-built site.',
  trust: 'Addressing this can make visitors more comfortable getting in touch.',
  mobile: 'A smoother mobile experience matters — most visitors will be on a phone.',
  conversion: 'This directly affects whether an interested visitor actually gets in touch.',
  localSeo: 'This can help your business show up more strongly for local, nearby searches.',
};

/** Pure, evidence-based translation of failed technical checks into business-framed opportunities. Never invents specifics beyond what the recommendation already evidences. */
export function buildGrowthOpportunities(recommendations: Recommendation[], limit = 6): GrowthOpportunity[] {
  return recommendations.slice(0, limit).map((rec) => ({
    id: rec.id,
    technicalIssue: rec.title,
    businessOpportunity: OPPORTUNITY_COPY[rec.id] ?? CATEGORY_FALLBACK[rec.category],
    category: rec.category,
    severity: rec.severity,
  }));
}

export { CATEGORY_LABELS };
