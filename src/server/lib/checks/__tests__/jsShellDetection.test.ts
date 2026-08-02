import { describe, it, expect } from 'vitest';
import { makePageData } from '../__fixtures__/pageData';
import { looksLikeJsAppShell } from '../shared/jsShellDetection';

describe('looksLikeJsAppShell', () => {
  it('detects a React/Vite-style empty root shell', () => {
    const page = makePageData({
      html: '<html><head><script type="module" crossorigin src="/assets/index-abc123.js"></script></head><body><div id="root"></div></body></html>',
      bodyText: '',
      h1s: [],
      headings: [],
      forms: [],
      buttons: [],
    });
    expect(looksLikeJsAppShell(page)).toBe(true);
  });

  it('detects a Next.js-style shell (__next root, no content)', () => {
    const page = makePageData({
      html: '<html><body><div id="__next"></div><script src="/_next/static/chunks/main.js"></script></body></html>',
      bodyText: '',
      h1s: [],
      headings: [],
      forms: [],
      buttons: [],
    });
    expect(looksLikeJsAppShell(page)).toBe(true);
  });

  it('does NOT flag a normal static website with real content', () => {
    const page = makePageData({
      html: '<html><body><h1>Dean\'s Painting & Decorating</h1><p>Professional painters and decorators serving the local area for over 15 years. We offer free quotes, fully insured work, and a satisfaction guarantee on every job.</p><form><input name="email"/></form></body></html>',
      bodyText: "Dean's Painting & Decorating Professional painters and decorators serving the local area for over 15 years. We offer free quotes, fully insured work, and a satisfaction guarantee on every job.",
      h1s: ["Dean's Painting & Decorating"],
      headings: [{ level: 1, text: "Dean's Painting & Decorating" }],
      forms: [{ hasLabelsForAllInputs: true, inputCount: 1, fields: ["email"] }],
      buttons: [],
    });
    expect(looksLikeJsAppShell(page)).toBe(false);
  });

  it('does NOT flag a small legitimate local-business homepage just because it is short', () => {
    const page = makePageData({
      html: '<html><body><h1>Joe\'s Plumbing</h1><p>Call 01234 567890 for a free quote.</p></body></html>',
      bodyText: "Joe's Plumbing Call 01234 567890 for a free quote.",
      h1s: ["Joe's Plumbing"],
      headings: [{ level: 1, text: "Joe's Plumbing" }],
      forms: [],
      buttons: [],
    });
    expect(looksLikeJsAppShell(page)).toBe(false);
  });

  it('does NOT flag a page with a real heading and a form even if word count is low', () => {
    const page = makePageData({
      html: '<html><body><h1>Contact</h1><form><input name="email"/></form></body></html>',
      bodyText: 'Contact',
      h1s: ['Contact'],
      headings: [{ level: 1, text: 'Contact' }],
      forms: [{ hasLabelsForAllInputs: true, inputCount: 1, fields: ["email"] }],
      buttons: [],
    });
    expect(looksLikeJsAppShell(page)).toBe(false);
  });

  it('flags a large HTML payload (big JS bundle references) with almost no visible text', () => {
    const bigScriptBlock = Array.from({ length: 80 }, (_, i) => `<script src="/assets/chunk-${i}.js"></script>`).join('');
    const page = makePageData({
      html: `<html><head>${bigScriptBlock}</head><body><div id="app"></div></body></html>`,
      bodyText: '',
      h1s: [],
      headings: [],
      forms: [],
      buttons: [],
    });
    expect(page.html.length).toBeGreaterThan(2000);
    expect(looksLikeJsAppShell(page)).toBe(true);
  });

  it('rendered pages are never checked by this function directly — callers gate on `!rendered` themselves', () => {
    // documents the calling convention (see conversion.ts/seo.ts): looksLikeJsAppShell only
    // ever receives the static PageData, and callers only invoke it when `rendered` is null.
    const page = makePageData({ bodyText: '', h1s: [], headings: [], forms: [], buttons: [] });
    expect(typeof looksLikeJsAppShell(page)).toBe('boolean');
  });
});
