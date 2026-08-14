import type { PageData } from '../../fetchSite';
import type { RenderedPageData } from '../../renderPage';
import type { CheckResult } from '../../../../lib/types';

export function findCheck(checks: CheckResult[], id: string): CheckResult {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`check ${id} not found`);
  return found;
}

/** A minimal, mostly-empty PageData — the "static-HTML-only, JS never ran" shape that caused
 * every false positive this test suite exists to prevent a regression of. */
export function makePageData(overrides: Partial<PageData> = {}): PageData {
  return {
    finalUrl: 'https://example.com/',
    status: 200,
    headers: {},
    html: '<html><body><div id="root"></div></body></html>',
    title: null,
    metaDescription: null,
    metaRobots: null,
    canonical: null,
    viewport: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    htmlLang: 'en',
    charset: 'utf-8',
    openGraph: {},
    twitterCard: {},
    h1s: [],
    headings: [],
    images: [],
    links: [],
    iframes: [],
    ids: [],
    forms: [],
    buttons: [],
    jsonLd: [],
    jsonLdParseErrors: 0,
    bodyText: '',
    isHttps: true,
    manifestDisplay: null,
    ...overrides,
  };
}

export function makeRenderedPageData(overrides: Partial<RenderedPageData> = {}): RenderedPageData {
  return {
    renderedHtml: '<html><body></body></html>',
    visibleText: '',
    h1s: [],
    headings: [],
    images: [],
    links: [],
    buttons: [],
    forms: [],
    jsonLd: [],
    stickyOrFixedElements: [],
    focusTest: { sampled: 0, withVisibleIndicator: 0 },
    viewportOverflow: [
      { width: 375, overflowPx: 0 },
      { width: 768, overflowPx: 0 },
      { width: 1280, overflowPx: 0 },
    ],
    tapTargets: { total: 0, tooSmall: 0 },
    renderMs: 1200,
    browserPerformance: null,
    ...overrides,
  };
}
