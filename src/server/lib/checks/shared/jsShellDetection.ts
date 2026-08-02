import type { PageData } from '../../fetchSite';

/**
 * Detects whether a page's STATIC (pre-JS) HTML is very likely a client-rendered app shell —
 * i.e. the real content genuinely cannot be observed without executing JavaScript — as opposed
 * to a normal static/server-rendered page that simply doesn't have much content.
 *
 * This exists because a growing share of scanned sites are React/Vue/Next-style SPAs whose raw
 * HTTP response is just `<div id="root"></div>` plus a script tag. When Browser Rendering is
 * unavailable for a scan (budget exhausted, binding missing, a genuine failure), the static-only
 * checks would otherwise report "no CTA / no forms / no content" — which is true of the HTML
 * bytes, but false about the actual website a visitor sees. That's a false failure, not a real
 * finding, and must not be scored as one.
 *
 * The opposite mistake is just as real: a small, genuinely static local-business homepage is
 * often short too (a hero, a phone number, a short paragraph) — treating "short" alone as "this
 * must be a JS shell" would blind the scanner to real missing-CTA/missing-form problems on
 * exactly the sites Growth Audit exists to help. So this deliberately requires MULTIPLE
 * independent signals to agree, not one threshold — see the 4 signals below. A real static site
 * almost always fails at least 2 of them (it has a heading, or a form, or more than a
 * paragraph's worth of text); a genuine CSR shell fails all 4.
 */
export function looksLikeJsAppShell(page: PageData): boolean {
  const text = (page.bodyText ?? '').trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const htmlLength = page.html?.length ?? 0;

  // Signal 1: almost no visible text at all. 25 words is deliberately low — a one-line "under
  // construction" static page would still trip this, but so would a real shell; it only
  // matters combined with the other signals below.
  const veryLowWordCount = wordCount < 25;

  // Signal 2: no headings of any kind (not even an H1) in the static HTML. A real page —
  // even a minimal one — almost always has at least one heading rendered server-side; a CSR
  // shell has none until JS mounts the app.
  const noHeadings = (page.h1s?.length ?? 0) === 0 && (page.headings?.length ?? 0) === 0;

  // Signal 3: no interactive elements at all in the static HTML — no form, no button. A real
  // page (even a simple brochure site) usually has at least a contact form or a nav toggle;
  // a shell has neither until JS runs.
  const noInteractiveElements = (page.forms?.length ?? 0) === 0 && (page.buttons?.length ?? 0) === 0;

  // Signal 4: the HTML document itself isn't tiny (it's a real, substantial response — likely
  // containing script tags, a large inline bundle reference, build-tool markers, etc.) while
  // almost none of that bytes-on-the-wire actually became visible text. A genuinely small
  // static site has a small HTML document AND a proportionally small (but real) amount of text
  // — this signal specifically catches "big HTML payload, empty-looking page", which a small
  // legitimate site never produces.
  const largeHtmlAlmostNoText = htmlLength > 2000 && text.length < 200;

  const signals = [veryLowWordCount, noHeadings, noInteractiveElements, largeHtmlAlmostNoText];
  const signalsTriggered = signals.filter(Boolean).length;

  // Require at least 3 of 4 independent signals — conservative on purpose (see module comment).
  return signalsTriggered >= 3;
}
