import { describe, it, expect } from 'vitest';
import { makePageData, makeRenderedPageData, findCheck } from '../__fixtures__/pageData';
import { runConversionChecks } from '../conversion';


describe('conv.stickyCta', () => {
  it('finds a real computed sticky/fixed element from rendered data (not a regex over inline style)', () => {
    const page = makePageData({ html: '<html></html>' }); // no inline style/regex hint at all
    const rendered = makeRenderedPageData({ stickyOrFixedElements: [{ text: 'Book a call', position: 'fixed' }] });
    expect(findCheck(runConversionChecks(page, rendered), 'conv.stickyCta').passed).toBe(true);
  });

  it('is not_verified (not a hard fail) without rendering, even though sticky is usually in an external stylesheet', () => {
    const page = makePageData({ html: '<html></html>' });
    const check = findCheck(runConversionChecks(page, null), 'conv.stickyCta');
    expect(check.status).toBe('not_verified');
    expect(check.weight).toBe(0);
  });
});

describe('conv.bookingLink', () => {
  it('recognises a broadened provider (Housecall Pro) not in the original list', () => {
    const page = makePageData({ html: '<a href="https://app.housecallpro.com/book/abc">Book now</a>' });
    expect(findCheck(runConversionChecks(page, null), 'conv.bookingLink').passed).toBe(true);
  });

  it('recognises a custom-domain booking widget via language heuristic when rendered', () => {
    const page = makePageData({ html: '<html></html>' });
    const rendered = makeRenderedPageData({ buttons: [{ text: 'Book an appointment', hasAccessibleName: true, visible: true }] });
    expect(findCheck(runConversionChecks(page, rendered), 'conv.bookingLink').passed).toBe(true);
  });

  it('is not_verified with the exact requested phrasing when nothing found and static-only', () => {
    const page = makePageData({ html: '<html></html>', bodyText: '' });
    const check = findCheck(runConversionChecks(page, null), 'conv.bookingLink');
    expect(check.status).toBe('not_verified');
    expect(check.detail).toMatch(/could not be confidently verified/i);
  });

  it('recognises "Book a discovery call" — caught live in remote testing as a real false negative', () => {
    const page = makePageData({ html: '<html></html>' });
    const rendered = makeRenderedPageData({
      visibleText: 'Book a discovery call.',
      buttons: [{ text: 'Book a discovery call', hasAccessibleName: true, visible: true }],
    });
    expect(findCheck(runConversionChecks(page, rendered), 'conv.bookingLink').passed).toBe(true);
  });
});
