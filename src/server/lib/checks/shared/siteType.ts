import type { PageData } from '../../fetchSite';
import type { RenderedPageData } from '../../renderPage';

const APP_SCHEMA_TYPES = new Set(['SoftwareApplication', 'WebApplication', 'MobileApplication']);
// Deliberately NOT plain 'Organization' here — a SoftwareApplication's own `creator`/`publisher`
// is conventionally an Organization (Growth Audit's own schema does exactly this for Dean Da
// Dev), so treating bare Organization presence as "this is a local business" would immediately
// defeat the purpose. Only a true LocalBusiness-family type, or any block that actually carries
// a street `address`, counts as a real local-business signal.
const LOCAL_BUSINESS_TYPES = new Set(['LocalBusiness', 'HomeAndConstructionBusiness']);

function flattenJsonLd(blocks: unknown[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const graph = (block as Record<string, unknown>)['@graph'];
    const entries = Array.isArray(block) ? block : Array.isArray(graph) ? graph : [block];
    for (const entry of entries) {
      if (entry && typeof entry === 'object') items.push(entry as Record<string, unknown>);
    }
  }
  return items;
}

function hasSchemaType(items: Record<string, unknown>[], types: Set<string>): boolean {
  return items.some((item) => {
    const t = item['@type'];
    const typeList = Array.isArray(t) ? t : [t];
    return typeList.some((tt) => typeof tt === 'string' && types.has(tt));
  });
}

/**
 * True when the page's own structured data declares itself a software product (e.g. Growth
 * Audit itself) rather than a physical/local business. A handful of checks — Google Business
 * Profile link, NAP, dedicated location pages, service-area phrasing, review-count display,
 * click-to-call — only make sense for a local business; forcing them on a SaaS/web-app site
 * would penalise it for lacking things it was never meant to have. Requires an explicit,
 * self-declared SoftwareApplication/WebApplication/MobileApplication type (not a heuristic
 * guess), and backs off if a LocalBusiness-type block is ALSO present — a real business that
 * also happens to be an app (e.g. a booking platform for a physical shop) still gets the full
 * local-SEO check set.
 */
export function isSoftwareProductSite(jsonLd: unknown[]): boolean {
  const items = flattenJsonLd(jsonLd);
  const declaresApp = hasSchemaType(items, APP_SCHEMA_TYPES);
  if (!declaresApp) return false;
  return !hasLocalBusinessJsonLdSignal(jsonLd);
}

function hasLocalBusinessJsonLdSignal(jsonLd: unknown[]): boolean {
  const items = flattenJsonLd(jsonLd);
  return hasSchemaType(items, LOCAL_BUSINESS_TYPES) || items.some((item) => Boolean(item.address));
}

export type SiteType = 'app' | 'website';

export interface SiteTypeResult {
  type: SiteType;
  /** Why this call was made — surfaced in the report so an "app" label is never an unexplained guess. */
  reason: string;
}

const APP_SUBDOMAIN_LABELS = new Set(['app', 'portal', 'dashboard', 'console', 'my', 'account']);

/**
 * A genuine subdomain beyond "www" (3+ hostname labels, e.g. "app.example.com") whose leading
 * label is a conventional app-infrastructure name. Requires the full 3-label form deliberately —
 * an apex or bare "www." domain would otherwise trivially match, since `labels[0]` would just be
 * the business's own name or "www".
 */
function appSubdomainLabel(finalUrl: string): string | null {
  try {
    const labels = new URL(finalUrl).hostname.split('.');
    if (labels.length < 3) return null;
    const first = labels[0].toLowerCase();
    return APP_SUBDOMAIN_LABELS.has(first) ? first : null;
  } catch {
    return null;
  }
}

const STANDALONE_DISPLAY_MODES = new Set(['standalone', 'fullscreen', 'minimal-ui']);

/**
 * A web app manifest declaring "standalone"/"fullscreen"/"minimal-ui" display asks the OS to
 * present the page chrome-less, like a native app, when installed — the whole point of that
 * mode is to NOT look like a browser tab. "browser" (or no manifest at all) is the default for
 * an ordinary marketing site and is never treated as a signal.
 */
function hasStandaloneManifest(page: PageData): boolean {
  return !!page.manifestDisplay && STANDALONE_DISPLAY_MODES.has(page.manifestDisplay.toLowerCase());
}

/**
 * A password-type field is the clearest signal of a real sign-in form. On the static side,
 * HTMLRewriter records each input's `name` attribute, falling back to its `type` when no name is
 * set (see fetchSite.ts) — so this also catches an unnamed password input, not just
 * `name="password"`. When a rendered snapshot is available, its forms are checked too (see
 * renderPage.ts's `hasPasswordField`) — the overwhelming majority of modern SaaS sign-in forms
 * are entirely client-rendered, so the static HTML alone would see no form at all.
 */
function hasPasswordField(page: PageData, rendered?: RenderedPageData | null): boolean {
  const staticHit = page.forms.some((form) => form.fields.some((field) => /password/i.test(field)));
  const renderedHit = rendered?.forms.some((form) => form.hasPasswordField) ?? false;
  return staticHit || renderedHit;
}

const SIGN_IN_VOCABULARY = /\b(sign[\s-]?in|log[\s-]?in|log[\s-]?on|welcome back|forgot(\s+your)?\s+password|reset\s+password)\b/i;

// "Continue with Google", "Sign in with Microsoft", etc. — third-party/SSO sign-in is an
// extremely specific, almost never false-positive signal of an application account system.
// Strong enough to stand alone (no password field required), since a local business's marketing
// site essentially never uses this phrasing.
const SSO_VOCABULARY = /\b(continue|sign[\s-]?in|sign[\s-]?up|log[\s-]?in)\s+with\s+(google|microsoft|apple|github|facebook|linkedin|okta|azure\s?ad)\b/i;

/**
 * Text to scan for sign-in/SSO vocabulary — the static title/H1s, plus (when a rendered
 * snapshot is available) the rendered H1s, button text, and a slice of visible text. A
 * client-rendered SPA's login screen (React/Vue app whose "Sign in" heading and "Continue with
 * Google" button are mounted by JS) is invisible to the static HTML alone.
 */
function signInHaystack(page: PageData, rendered?: RenderedPageData | null): string {
  const staticText = `${page.title ?? ''} ${page.h1s.join(' ')}`;
  if (!rendered) return staticText;
  const renderedText = `${rendered.h1s.join(' ')} ${rendered.buttons.map((b) => b.text).join(' ')} ${rendered.visibleText.slice(0, 2000)}`;
  return `${staticText} ${renderedText}`;
}

/**
 * Classifies whether the scanned page is a web application (a SaaS product, dashboard, or
 * sign-in-gated tool) rather than a marketing/business website — so checks that only make sense
 * for a physical/local business (Google Business Profile, NAP, business hours, click-to-call...)
 * can be skipped instead of scored as failures. `rendered` is optional — when a Browser Rendering
 * pass is available, it's used to see client-rendered sign-in screens the static HTML can't;
 * without it, detection still works from static signals alone, just with narrower coverage.
 * Independent signals are tried in order of strength; the first that fires wins:
 *
 *  1. Explicit self-declaration via schema.org structured data (isSoftwareProductSite) — the
 *     strongest signal, since the site is telling us directly. Prefers the rendered snapshot's
 *     structured data when available (same convention as seo.ts) — JS-framework sites commonly
 *     inject schema.org data client-side, which a static-only fetch never sees.
 *  2. A conventional app-infrastructure subdomain (app./portal./dashboard./console./my./
 *     account.) with no competing LocalBusiness signal — this convention is used almost
 *     exclusively for applications, never for a business's own marketing site.
 *  3. A web app manifest declaring standalone/fullscreen/minimal-ui display, with no competing
 *     LocalBusiness signal — see hasStandaloneManifest.
 *  4. Third-party/SSO sign-in vocabulary ("Continue with Google", etc.), with no competing
 *     LocalBusiness signal — strong enough alone, no password field required (catches
 *     passwordless/SSO-only apps).
 *  5. A sign-in screen: a password field AND sign-in/login vocabulary, with no competing
 *     LocalBusiness signal — catches an app that neither self-declares via schema.org nor uses
 *     an app-style subdomain (e.g. a login page on the apex domain).
 *
 * Deliberately does NOT treat a short/sparse page (see jsShellDetection.ts) as an app signal on
 * its own — a small local-business homepage is just as often short, so that alone would
 * misclassify real local businesses rather than genuine apps.
 */
export function classifySiteType(page: PageData, rendered?: RenderedPageData | null): SiteTypeResult {
  const jsonLdSource = rendered ? rendered.jsonLd : page.jsonLd;

  if (isSoftwareProductSite(jsonLdSource)) {
    return { type: 'app', reason: 'This page\'s structured data (schema.org) explicitly declares it a software/web application.' };
  }

  const localBusinessSignal = hasLocalBusinessJsonLdSignal(jsonLdSource);

  const subdomain = appSubdomainLabel(page.finalUrl);
  if (subdomain && !localBusinessSignal) {
    return { type: 'app', reason: `The site is hosted on the "${subdomain}." subdomain — a convention used almost exclusively for web applications, not marketing sites.` };
  }

  if (hasStandaloneManifest(page) && !localBusinessSignal) {
    return { type: 'app', reason: `The site's web app manifest declares a "${page.manifestDisplay}" display mode — used for installable applications, not marketing sites.` };
  }

  const haystack = signInHaystack(page, rendered);

  if (SSO_VOCABULARY.test(haystack) && !localBusinessSignal) {
    return { type: 'app', reason: 'This page offers third-party sign-in (e.g. "Continue with Google") — used for application accounts, not marketing sites.' };
  }

  if (hasPasswordField(page, rendered) && SIGN_IN_VOCABULARY.test(haystack) && !localBusinessSignal) {
    return { type: 'app', reason: 'This page is a sign-in screen (a password field plus sign-in language, e.g. "Log in" or "Welcome back") with no local-business signals.' };
  }

  return { type: 'website', reason: 'No web-application signals detected — scored as a marketing/business website.' };
}
