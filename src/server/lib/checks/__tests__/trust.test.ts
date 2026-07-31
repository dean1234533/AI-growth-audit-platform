import { describe, it, expect } from 'vitest';
import { makePageData, makeRenderedPageData, findCheck } from '../__fixtures__/pageData';
import { runTrustChecks } from '../trust';


describe('trust.googleMaps', () => {
  it('shares the same broadened detector as local.gbp — recognises share.google', () => {
    const page = makePageData({ html: '<a href="https://share.google/tm6xClvShNu7cLlYt">Map</a>' });
    expect(findCheck(runTrustChecks(page), 'trust.googleMaps').passed).toBe(true);
  });
});

describe('trust.testimonials', () => {
  it('finds JS-widget-rendered testimonials that are invisible in static HTML', () => {
    const page = makePageData({ bodyText: '' }); // static: nothing
    const rendered = makeRenderedPageData({ visibleText: 'What our customers say: 5 star service every time.' });
    expect(findCheck(runTrustChecks(page, rendered), 'trust.testimonials').passed).toBe(true);
  });

  it('is not_verified (not a hard fail) when static-only and nothing found', () => {
    const page = makePageData({ bodyText: 'Welcome to our site.' });
    const check = findCheck(runTrustChecks(page, null), 'trust.testimonials');
    expect(check.status).toBe('not_verified');
  });
});
