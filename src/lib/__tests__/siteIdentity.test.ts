import { describe, expect, it } from 'vitest';
import { deriveSiteName, monitoredSiteName, siteKind } from '../siteIdentity';

describe('site identity', () => {
  it('prefers the supplied business name over the URL', () => {
    expect(deriveSiteName({
      url: 'https://dbworkouts.co.uk/',
      meta: { businessName: 'DB Workouts', pageTitle: 'Online training | DB Workouts' },
    })).toBe('DB Workouts');
  });

  it('uses a meaningful page-title segment when no business name was supplied', () => {
    expect(deriveSiteName({
      url: 'https://example.co.uk/',
      meta: { pageTitle: 'Dashboard | Northstar' },
    })).toBe('Northstar');
  });

  it('does not repeat a hostname as the display name', () => {
    expect(monitoredSiteName({ url: 'https://dean-da-dev.co.uk/', name: 'dean-da-dev.co.uk' })).toBe('Dean Da Dev');
  });

  it('labels apps, websites and unknown older records honestly', () => {
    expect(siteKind('app')).toBe('App');
    expect(siteKind('website')).toBe('Website');
    expect(siteKind()).toBe('Site');
  });
});
