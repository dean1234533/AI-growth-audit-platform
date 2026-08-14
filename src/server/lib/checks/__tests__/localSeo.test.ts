import { describe, it, expect } from 'vitest';
import { makePageData, findCheck } from '../__fixtures__/pageData';
import { runLocalSeoChecks } from '../localSeo';


describe('local.gbp', () => {
  it('recognises a share.google link (previously missed entirely)', () => {
    const page = makePageData({ html: '<a href="https://share.google/tm6xClvShNu7cLlYt">View on Google</a>' });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.gbp').passed).toBe(true);
  });

  it('recognises a maps.app.goo.gl link (previously missed entirely)', () => {
    const page = makePageData({ html: '<a href="https://maps.app.goo.gl/abc123">Find us</a>' });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.gbp').passed).toBe(true);
  });

  it('recognises a classic google.com/maps/place link', () => {
    const page = makePageData({ html: '<a href="https://www.google.com/maps/place/Some+Business">Find us</a>' });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.gbp').passed).toBe(true);
  });

  it('does not false-positive on an unrelated google.com link', () => {
    const page = makePageData({ html: '<a href="https://www.google.com/search?q=hello">Search</a>' });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.gbp').passed).toBe(false);
  });
});

describe('local.locationPages', () => {
  it('recognises a /areas/<place> hub cluster, not just single-segment slugs', () => {
    const page = makePageData({
      links: [
        { href: '/areas/wanstead', text: 'Wanstead' },
        { href: '/areas/ilford', text: 'Ilford' },
        { href: '/areas/leyton', text: 'Leyton' },
      ],
    });
    const check = findCheck(runLocalSeoChecks(page, false), 'local.locationPages');
    expect(check.passed).toBe(true);
  });

  it('does not treat an unrelated "/account/member-area" link as a location page', () => {
    const page = makePageData({ links: [{ href: '/account/member-area', text: 'Member area' }] });
    const check = findCheck(runLocalSeoChecks(page, false), 'local.locationPages');
    expect(check.passed).toBe(false);
  });

  it('still recognises the flat "personal-trainer-stratford" style cluster', () => {
    const page = makePageData({
      links: [
        { href: '/personal-trainer-stratford', text: '' },
        { href: '/personal-trainer-ilford', text: '' },
        { href: '/personal-trainer-leyton', text: '' },
        { href: '/personal-trainer-wanstead', text: '' },
      ],
    });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.locationPages').passed).toBe(true);
  });
});

describe('local.nap', () => {
  it('accepts a postcode district alone as a weaker but genuine signal', () => {
    const page = makePageData({ bodyText: 'Based in Stratford, London E15, working across the UK.' });
    const check = findCheck(runLocalSeoChecks(page, false), 'local.nap');
    expect(check.passed).toBe(true);
    expect(check.detail).toMatch(/district/i);
  });

  it('still fails when there is no address signal at all', () => {
    const page = makePageData({ bodyText: 'We build great websites for great businesses.' });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.nap').passed).toBe(false);
  });
});

describe('local.reviews', () => {
  it('tolerates real-world phrasing like "9 verified Google Reviews"', () => {
    const page = makePageData({ bodyText: '9 verified Google Reviews. 5.0 out of 5.' });
    expect(findCheck(runLocalSeoChecks(page, false), 'local.reviews').passed).toBe(true);
  });
});
