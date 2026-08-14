import { describe, it, expect } from 'vitest';
import { makePageData, makeRenderedPageData } from '../__fixtures__/pageData';
import { classifySiteType, isSoftwareProductSite } from '../shared/siteType';

describe('classifySiteType', () => {
  it('classifies a plain local-business homepage as a website', () => {
    const page = makePageData({
      finalUrl: 'https://joesplumbing.co.uk/',
      title: "Joe's Plumbing",
      h1s: ["Joe's Plumbing"],
      bodyText: 'Call 01234 567890 for a free quote.',
    });
    const result = classifySiteType(page);
    expect(result.type).toBe('website');
  });

  it('classifies a page that self-declares SoftwareApplication schema as an app', () => {
    const page = makePageData({
      finalUrl: 'https://example.com/',
      jsonLd: [{ '@type': 'SoftwareApplication', name: 'Growth Audit' }],
    });
    const result = classifySiteType(page);
    expect(result.type).toBe('app');
    expect(result.reason).toMatch(/structured data/i);
  });

  it('classifies an app./portal./dashboard. subdomain as an app', () => {
    const page = makePageData({ finalUrl: 'https://app.example.com/' });
    const result = classifySiteType(page);
    expect(result.type).toBe('app');
    expect(result.reason).toMatch(/subdomain/i);
  });

  it('does NOT treat a bare apex or www domain as an app subdomain', () => {
    const apex = classifySiteType(makePageData({ finalUrl: 'https://example.com/' }));
    const www = classifySiteType(makePageData({ finalUrl: 'https://www.example.com/' }));
    expect(apex.type).toBe('website');
    expect(www.type).toBe('website');
  });

  it('classifies a sign-in screen (password field + sign-in vocabulary) as an app even without schema or a special subdomain', () => {
    const page = makePageData({
      finalUrl: 'https://example.com/login',
      title: 'Sign in to your account',
      h1s: ['Welcome back'],
      forms: [{ hasLabelsForAllInputs: true, inputCount: 2, fields: ['email', 'password'] }],
    });
    const result = classifySiteType(page);
    expect(result.type).toBe('app');
    expect(result.reason).toMatch(/sign-in screen/i);
  });

  it('does NOT classify as an app from a password field alone, without sign-in vocabulary', () => {
    const page = makePageData({
      finalUrl: 'https://example.com/',
      forms: [{ hasLabelsForAllInputs: true, inputCount: 2, fields: ['email', 'password'] }],
    });
    expect(classifySiteType(page).type).toBe('website');
  });

  it('backs off to website when an app-style subdomain also carries a real LocalBusiness signal', () => {
    const page = makePageData({
      finalUrl: 'https://my.joesplumbing.co.uk/',
      jsonLd: [{ '@type': 'LocalBusiness', name: "Joe's Plumbing" }],
    });
    expect(classifySiteType(page).type).toBe('website');
  });

  it('does NOT flag a short/sparse static page as an app on word-count alone', () => {
    // A small legitimate local-business homepage is often short too — classifySiteType must not
    // reuse the jsShellDetection "sparse content" signal as evidence of being an app.
    const page = makePageData({
      finalUrl: 'https://example.com/',
      html: '<html><body><div id="root"></div></body></html>',
      bodyText: '',
      h1s: [],
    });
    expect(classifySiteType(page).type).toBe('website');
  });

  it('classifies a standalone/fullscreen web app manifest as an app', () => {
    const standalone = classifySiteType(makePageData({ finalUrl: 'https://example.com/', manifestDisplay: 'standalone' }));
    const fullscreen = classifySiteType(makePageData({ finalUrl: 'https://example.com/', manifestDisplay: 'fullscreen' }));
    expect(standalone.type).toBe('app');
    expect(standalone.reason).toMatch(/manifest/i);
    expect(fullscreen.type).toBe('app');
  });

  it('does NOT treat a "browser" display manifest (the default for an ordinary site) as an app signal', () => {
    const page = makePageData({ finalUrl: 'https://example.com/', manifestDisplay: 'browser' });
    expect(classifySiteType(page).type).toBe('website');
  });

  it('classifies third-party/SSO sign-in vocabulary as an app, even with no password field at all', () => {
    const page = makePageData({
      finalUrl: 'https://example.com/login',
      title: 'Continue with Google',
      h1s: ['Continue with Google'],
      forms: [], // no password field anywhere — SSO vocabulary alone must be enough
    });
    const result = classifySiteType(page);
    expect(result.type).toBe('app');
    expect(result.reason).toMatch(/third-party sign-in/i);
  });

  it('detects a client-rendered sign-in screen (password field + heading only visible after rendering)', () => {
    const staticPage = makePageData({
      finalUrl: 'https://example.com/login',
      html: '<html><body><div id="root"></div></body></html>',
      bodyText: '',
      h1s: [],
      forms: [],
    });
    // Static-only: nothing to see, so it must default to website rather than guessing.
    expect(classifySiteType(staticPage).type).toBe('website');

    const rendered = makeRenderedPageData({
      h1s: ['Welcome back'],
      forms: [{ fieldCount: 2, unlabelledFieldCount: 0, hasPasswordField: true }],
    });
    const result = classifySiteType(staticPage, rendered);
    expect(result.type).toBe('app');
  });

  it('detects rendered SSO vocabulary that only exists in the client-rendered DOM', () => {
    const staticPage = makePageData({
      finalUrl: 'https://example.com/login',
      html: '<html><body><div id="root"></div></body></html>',
      bodyText: '',
      h1s: [],
    });
    const rendered = makeRenderedPageData({ buttons: [{ text: 'Continue with Google', hasAccessibleName: true, visible: true }] });
    const result = classifySiteType(staticPage, rendered);
    expect(result.type).toBe('app');
    expect(result.reason).toMatch(/third-party sign-in/i);
  });

  it('prefers the rendered snapshot\'s structured data for the schema.org self-declaration signal', () => {
    const staticPage = makePageData({ finalUrl: 'https://example.com/', jsonLd: [] });
    const rendered = makeRenderedPageData({ jsonLd: [{ '@type': 'SoftwareApplication' }] });
    const result = classifySiteType(staticPage, rendered);
    expect(result.type).toBe('app');
  });

  it('still backs off to website when a LocalBusiness signal accompanies an app-style subdomain and manifest', () => {
    const page = makePageData({
      finalUrl: 'https://app.joesplumbing.co.uk/',
      manifestDisplay: 'standalone',
      jsonLd: [{ '@type': 'LocalBusiness', address: '1 Main St' }],
    });
    expect(classifySiteType(page).type).toBe('website');
  });
});

describe('isSoftwareProductSite (unchanged behaviour after refactor)', () => {
  it('still backs off when a LocalBusiness type is present alongside a SoftwareApplication type', () => {
    const jsonLd = [{ '@type': 'SoftwareApplication' }, { '@type': 'LocalBusiness', address: '1 Main St' }];
    expect(isSoftwareProductSite(jsonLd)).toBe(false);
  });

  it('still returns true for a bare SoftwareApplication declaration', () => {
    expect(isSoftwareProductSite([{ '@type': 'SoftwareApplication' }])).toBe(true);
  });
});
