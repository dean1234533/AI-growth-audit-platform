import puppeteer, { type BrowserWorker } from '@cloudflare/puppeteer';

export interface RenderedPageData {
  renderedHtml: string;
  visibleText: string;
  h1s: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string; text: string }[];
  buttons: { text: string; hasAccessibleName: boolean; visible: boolean }[];
  forms: { fieldCount: number; unlabelledFieldCount: number }[];
  jsonLd: unknown[];
  /** Elements with computed position sticky/fixed, sitting inside the viewport — the raw
   * signal conv.stickyCta filters for CTA-like text, rather than duplicating that logic here. */
  stickyOrFixedElements: { text: string; position: string }[];
  /** Real keyboard-Tab focus test: how many of the sampled focusable elements actually got a
   * visible outline/box-shadow/border change when focused, vs. their resting state. */
  focusTest: { sampled: number; withVisibleIndicator: number };
  /** document.documentElement.scrollWidth vs clientWidth at each tested viewport width. */
  viewportOverflow: { width: number; overflowPx: number }[];
  tapTargets: { total: number; tooSmall: number };
  renderMs: number;
}

const NAV_TIMEOUT_MS = 20_000;
const MAX_FOCUS_SAMPLE = 12;
const VIEWPORT_WIDTHS = [375, 768, 1280];

/**
 * Renders `url` in a real headless browser via Cloudflare's Browser Rendering binding and
 * extracts everything the static-HTML checks structurally can't see: visible text after JS
 * runs, computed layout/position, and real keyboard-focus behaviour. Returns null (never
 * throws) on any failure — callers must treat null as "couldn't verify", not "nothing here".
 */
export async function renderPage(browserBinding: BrowserWorker, url: string): Promise<RenderedPageData | null> {
  const start = Date.now();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_WIDTHS[0], height: 800 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT_MS });
    // networkidle0 only guarantees the network is quiet, not that a client-rendered app has
    // finished mounting and running its effects (route-specific metadata/schema is often set
    // in a useEffect, after first paint) — give it a brief settle window before capturing.
    await page.waitForSelector('footer', { timeout: 5000 }).catch(() => {});

    const renderedHtml = await page.content();

    const staticExtract = await page.evaluate(() => {
      function isVisible(el: Element): boolean {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
      }

      const h1s = [...document.querySelectorAll('h1')].map((h) => h.textContent?.trim() ?? '').filter(Boolean);
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
        level: Number(h.tagName[1]),
        text: h.textContent?.trim() ?? '',
      }));
      const images = [...document.querySelectorAll('img')].map((img) => ({ src: img.getAttribute('src') ?? '', alt: img.getAttribute('alt') }));
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href') ?? '', text: a.textContent?.trim() ?? '' }));
      const buttons = [...document.querySelectorAll('button, [role="button"]')].map((b) => ({
        text: b.textContent?.trim() ?? '',
        hasAccessibleName: !!(b.textContent?.trim() || b.getAttribute('aria-label') || b.getAttribute('aria-labelledby')),
        visible: isVisible(b),
      }));

      const forms = [...document.querySelectorAll('form')].map((form) => {
        const fields = [...form.querySelectorAll('input, textarea, select')].filter((f) => {
          const type = (f.getAttribute('type') || 'text').toLowerCase();
          return !['hidden', 'submit', 'button'].includes(type);
        });
        const unlabelled = fields.filter((f) => {
          if (f.getAttribute('aria-hidden') === 'true') return false; // e.g. a honeypot — correctly excluded from a11y requirements
          const hasAriaLabel = !!f.getAttribute('aria-label') || !!f.getAttribute('aria-labelledby');
          const id = f.getAttribute('id');
          const hasForLabel = !!id && !!document.querySelector(`label[for="${CSS.escape(id)}"]`);
          const hasWrappingLabel = !!f.closest('label');
          const hasPlaceholder = !!f.getAttribute('placeholder');
          return !hasAriaLabel && !hasForLabel && !hasWrappingLabel && !hasPlaceholder;
        });
        return { fieldCount: fields.length, unlabelledFieldCount: unlabelled.length };
      });

      const jsonLd: unknown[] = [];
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          jsonLd.push(JSON.parse(script.textContent ?? ''));
        } catch {
          // invalid JSON-LD is a separate, already-existing check on the static side
        }
      }

      const stickyOrFixedElements: { text: string; position: string }[] = [];
      for (const el of document.body.querySelectorAll('*')) {
        const style = window.getComputedStyle(el);
        if (style.position !== 'sticky' && style.position !== 'fixed') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.top > window.innerHeight || rect.bottom < 0) continue;
        const text = el.textContent?.trim().slice(0, 120) ?? '';
        if (!text) continue;
        stickyOrFixedElements.push({ text, position: style.position });
      }

      const visibleText = document.body.innerText ?? '';

      return { h1s, headings, images, links, buttons, forms, jsonLd, stickyOrFixedElements, visibleText };
    });

    // Real keyboard-Tab focus test, separate from the DOM snapshot above since it mutates focus state.
    const focusTest = await page.evaluate(async (maxSample: number) => {
      const focusable = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.tabIndex !== -1;
      });
      const sample = focusable.slice(0, maxSample);
      let withVisibleIndicator = 0;
      for (const el of sample) {
        const restingOutline = window.getComputedStyle(el).outlineStyle;
        const restingShadow = window.getComputedStyle(el).boxShadow;
        el.focus();
        const focusedStyle = window.getComputedStyle(el);
        const outlineChanged = focusedStyle.outlineStyle !== 'none' && focusedStyle.outlineStyle !== restingOutline;
        const shadowChanged = focusedStyle.boxShadow !== 'none' && focusedStyle.boxShadow !== restingShadow;
        if (outlineChanged || shadowChanged) withVisibleIndicator += 1;
        el.blur();
      }
      return { sampled: sample.length, withVisibleIndicator };
    }, MAX_FOCUS_SAMPLE);

    // Tap-target sizing at the mobile width the page already loaded at.
    const tapTargets = await page.evaluate(() => {
      const targets = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const tooSmall = targets.filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width < 24 || rect.height < 24;
      });
      return { total: targets.length, tooSmall: tooSmall.length };
    });

    // Overflow at each breakpoint — resize in place rather than reload, since the content already loaded.
    const viewportOverflow: { width: number; overflowPx: number }[] = [];
    for (const width of VIEWPORT_WIDTHS) {
      await page.setViewport({ width, height: 800 });
      const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      viewportOverflow.push({ width, overflowPx });
    }

    return {
      renderedHtml,
      visibleText: staticExtract.visibleText,
      h1s: staticExtract.h1s,
      headings: staticExtract.headings,
      images: staticExtract.images,
      links: staticExtract.links,
      buttons: staticExtract.buttons,
      forms: staticExtract.forms,
      jsonLd: staticExtract.jsonLd,
      stickyOrFixedElements: staticExtract.stickyOrFixedElements,
      focusTest,
      viewportOverflow,
      tapTargets,
      renderMs: Date.now() - start,
    };
  } catch (err) {
    console.error(`renderPage: failed for ${url}:`, err);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
