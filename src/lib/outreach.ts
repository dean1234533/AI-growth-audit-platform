import type { AuditResult, CategoryId, Recommendation } from './types';

export const AUDIT_TOOL_URL = 'https://app.dean-da-dev.co.uk/';

/**
 * Turns a completed audit into short, personal outreach messages (email/WhatsApp/Instagram DM).
 * This is the single source of truth for outreach copy — there is deliberately no other
 * template/generator in the codebase; if you're tempted to write a one-off message by hand,
 * use buildOutreachMessages() instead so wording stays consistent and never invents a finding.
 *
 * The core idea: the AUDIT TOOL is the thing being offered, not a sales pitch. Every message
 * leads with who Dean is and why he looked at this specific business, cites 1-2 REAL findings
 * (never invented, never a technical check id — see selectOutreachFindings), and sends the
 * recipient to run their own audit rather than asking them to buy anything.
 */

export interface OutreachInput {
  /** e.g. "Riverside Plumbing" — from audit.meta.businessName, or derived from the URL if absent. */
  businessName: string;
  /** The person being contacted, if known — omit for a generic "Hi there,"/"Hey," opener. */
  contactName?: string;
  /** e.g. "plumbing", "painting and decorating" — from audit.meta.businessType. Omit if unknown; the message still works without it. */
  industry?: string;
  /** Already-computed, priority-sorted recommendations from the audit (AuditResult.recommendations) — never pass an unsorted or hand-picked list, so outreach always reflects what the audit actually found. */
  recommendations: Recommendation[];
  /** Optional — only ever shown as a secondary, low-emphasis link (see CORE REQUIREMENTS: audit is the primary CTA, not the portfolio). */
  portfolioUrl?: string;
}

/**
 * How outreach-worthy each category tends to be: does a typical business owner immediately
 * understand why this matters, without any technical context? Conversion/trust/local findings
 * translate directly to "would a customer be put off/could I be found" — the exact language a
 * business owner already thinks in. Pure technical SEO/performance findings are real and
 * sometimes worth leading with (a very slow site, a missing title tag), but only get picked
 * when nothing more relatable is available or the finding is genuinely severe.
 */
const CATEGORY_OUTREACH_WEIGHT: Record<CategoryId, number> = {
  conversion: 4,
  trust: 3.5,
  localSeo: 3.5,
  mobile: 3,
  accessibility: 2,
  performance: 2,
  seo: 1.5,
};

/**
 * Check ids that are real, valid findings but translate poorly into a one-line outreach message
 * even when phrased in plain English (they need visible context — "your canonical tag" means
 * nothing to a business owner without an SEO lesson first). Excluded from outreach selection
 * unless literally nothing else was found — see selectOutreachFindings.
 */
const TOO_TECHNICAL_FOR_OUTREACH = new Set([
  'seo.canonical',
  'seo.openGraph',
  'seo.twitterCard',
  'seo.robotsTxt',
  'seo.sitemap',
  'seo.multipleH1',
  'seo.h2Structure',
  'seo.metaDescriptionLength',
  'seo.titleLength',
  'local.schemaCompleteness',
  'trust.hsts',
  'trust.csp',
  'trust.frameProtection',
  'trust.contentTypeOptions',
  'trust.referrerPolicy',
  'trust.permissionsPolicy',
  'trust.mixedContent',
  'mobile.horizontalOverflow',
]);

/**
 * Short, conversational phrasings for the findings most worth leading an outreach message with
 * — deliberately NOT the same wording as the in-app recommendation titles (those are written as
 * imperative tasks for someone already using the product, e.g. "Add a clear primary
 * call-to-action"; outreach needs an observation about THEIR site, e.g. "your homepage doesn't
 * have a clear way for someone to get in touch"). Only the highest-value, most-relatable ids are
 * curated here; everything else falls back to derivePhraseFromRecommendation() below, so no
 * check id is ever left untranslated or shown raw.
 */
const OUTREACH_PHRASES: Partial<Record<string, string>> = {
  'conv.primaryCta': "there's no clear call-to-action on the homepage, so visitors aren't being pointed toward getting in touch",
  'conv.contactForm': "there's no contact or enquiry form, so anyone who doesn't want to call or email directly has no way to reach you",
  'conv.pricingInfo': "there's no pricing information visible, which is often the first thing people look for before getting in touch",
  'conv.trustBadges': "there's nothing on the page reassuring visitors you're accredited/insured before they enquire",
  'conv.faqSection': "there's no FAQ section answering the questions people usually have before reaching out",
  'conv.serviceDescriptions': 'the descriptions of what you actually offer are quite brief',
  'conv.phoneCta': "there's no tap-to-call link, so mobile visitors can't ring you directly from the page",
  'trust.contactPage': "there's no dedicated contact page",
  'trust.email': "there's no visible email address",
  'trust.testimonials': "there aren't any reviews or testimonials shown",
  'trust.socialLinks': "there are no social media links",
  'local.gbp': "your Google Business Profile isn't linked anywhere on the site",
  'local.reviews': "your Google reviews aren't shown on the site, even though they're often what convinces someone to get in touch",
  'local.serviceAreas': "it's not clear which areas you actually cover",
  'local.locationPages': "there's nothing helping you rank for searches in the specific areas you serve",
  'mobile.responsive': 'part of the layout breaks on mobile, which is where most visitors will actually land',
  'mobile.tapTargets': 'some buttons/links are quite small to tap accurately on a phone',
  'seo.missingTitle': "the homepage doesn't have a page title set, which search engines rely on heavily",
  'seo.missingMetaDescription': "there's no search-result description set, so Google is left to guess what to show under your listing",
  'seo.missingH1': "the homepage doesn't have a clear main heading, which search engines use to understand what the page is about",
  'perf.lcp': 'the homepage takes a noticeably long time to visually load',
  'perf.fcp': 'the site takes a while before anything visible shows up at all',
  'a11y.colorContrast': "some of the text is hard to read against its background",
};

/** Strips the leading "No X was found."-style clause down to a lowercase, mid-sentence fragment when no curated phrase exists — a safety net, never surfaces the raw check id. */
function derivePhraseFromRecommendation(rec: Recommendation): string {
  const firstSentence = rec.description.split(/(?<=[.!?])\s/)[0] ?? rec.description;
  const lowered = firstSentence.charAt(0).toLowerCase() + firstSentence.slice(1);
  return lowered.replace(/\.$/, '');
}

function phraseForFinding(rec: Recommendation): string {
  return OUTREACH_PHRASES[rec.id] ?? derivePhraseFromRecommendation(rec);
}

/**
 * Picks the 1-2 findings actually worth leading an outreach message with — see the module
 * comment for why this is a different ranking than the in-app recommendation order. Never
 * returns more than `max`, never invents a finding, and returns an empty array (never a
 * fabricated placeholder) if the audit genuinely found nothing worth mentioning — callers must
 * handle that case with a generic-but-honest opener (see buildOutreachMessages).
 */
export function selectOutreachFindings(recommendations: Recommendation[], max = 2): Recommendation[] {
  const actionable = recommendations.filter((r) => r.severity !== 'info');

  const scored = actionable
    .map((r) => ({ rec: r, score: r.priority * (CATEGORY_OUTREACH_WEIGHT[r.category] ?? 1) }))
    .sort((a, b) => b.score - a.score);

  const relatable = scored.filter((s) => !TOO_TECHNICAL_FOR_OUTREACH.has(s.rec.id));
  const pool = relatable.length > 0 ? relatable : scored; // fall back to technical findings only if nothing relatable exists at all

  return pool.slice(0, max).map((s) => s.rec);
}

function joinFindings(findings: Recommendation[]): string {
  const phrases = findings.map(phraseForFinding);
  if (phrases.length === 0) return '';
  if (phrases.length === 1) return phrases[0];
  return `${phrases[0]}, and ${phrases[1]}`;
}

function greeting(contactName?: string): string {
  return contactName ? `Hi ${contactName},` : 'Hi,';
}

function comingAcrossClause(businessName: string, industry?: string): string {
  return industry
    ? `I came across ${businessName} while looking at local ${industry} businesses`
    : `I came across ${businessName} while looking at local businesses`;
}

const TOOL_EXPLAINER = 'It checks things like SEO, site speed, mobile-friendliness, accessibility, trust signals and conversion — and gives you a plain-English list of what to fix.';

export interface EmailTemplate {
  subject: string;
  body: string;
}

const SEVERE = new Set(['critical', 'high']);

export function buildEmailTemplate(input: OutreachInput): EmailTemplate {
  const findings = selectOutreachFindings(input.recommendations);
  const findingsClause = joinFindings(findings);
  const hasSevereFinding = findings.some((f) => SEVERE.has(f.severity));

  const subject = `Quick website check for ${input.businessName}`;

  const findingsLine =
    findings.length === 0
      ? `I had a look at your website and ran it through an audit tool I built — it's actually in pretty good shape, nothing significant came up.`
      : hasSevereFinding
        ? `I had a look at your website and ran it through an audit tool I built — it picked up that ${findingsClause}.`
        : `I had a look at your website and ran it through an audit tool I built — it's actually in pretty good shape, just a couple of small things worth tightening up: ${findingsClause}.`;

  const body = `${greeting(input.contactName)}

I'm Dean — I'm a web developer and ${comingAcrossClause(input.businessName, input.industry)}.

${findingsLine} ${TOOL_EXPLAINER}

You can run your own site through it here:
${AUDIT_TOOL_URL}

It's free to run an audit and takes about 30 seconds — no signup needed just to check the site. If you want to save the result and get notified if anything changes later on, there's an option to create a free account too.

If anything useful comes up, happy to point you in the right direction.

Thanks,
Dean${input.portfolioUrl ? `\n${input.portfolioUrl}` : ''}`;

  return { subject, body };
}

export function buildWhatsAppTemplate(input: OutreachInput): string {
  const findings = selectOutreachFindings(input.recommendations, 1);
  const findingsClause = findings.length > 0 ? ` — it flagged that ${joinFindings(findings)}` : '';

  return `${greeting(input.contactName)} I'm Dean, a web developer — ${comingAcrossClause(input.businessName, input.industry)}. Ran your site through a free audit tool I built${findingsClause}. Worth a look if you've got a sec: ${AUDIT_TOOL_URL} — no signup needed, just enter your URL.`;
}

export function buildInstagramDmTemplate(input: OutreachInput): string {
  const findings = selectOutreachFindings(input.recommendations, 1);
  const findingsClause = findings.length > 0 ? ` It flagged that ${joinFindings(findings)}.` : '';

  return `Hey${input.contactName ? ` ${input.contactName}` : ''}, I'm Dean — I'm a web developer and came across ${input.businessName}. I ran your site through a free audit tool I built.${findingsClause} Thought I'd send it over in case you want the full results: ${AUDIT_TOOL_URL}`;
}

export interface OutreachMessages {
  email: EmailTemplate;
  whatsapp: string;
  instagram: string;
}

/** Convenience wrapper: builds all three channel templates directly from a completed AuditResult, extracting business/industry context from meta so callers don't have to. */
export function buildOutreachMessages(audit: AuditResult, opts: { contactName?: string; portfolioUrl?: string } = {}): OutreachMessages {
  const businessName = audit.meta.businessName?.trim() || deriveNameFromUrl(audit.url);
  const input: OutreachInput = {
    businessName,
    contactName: opts.contactName,
    industry: audit.meta.businessType?.trim() || undefined,
    recommendations: audit.recommendations,
    portfolioUrl: opts.portfolioUrl,
  };

  return {
    email: buildEmailTemplate(input),
    whatsapp: buildWhatsAppTemplate(input),
    instagram: buildInstagramDmTemplate(input),
  };
}

function deriveNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
