import { describe, it, expect } from 'vitest';
import { buildUptimeNotification, buildContentIssueNotification } from '../notificationRules';

const website = { id: 'site1', name: "Joe's Plumbing" };

describe('buildUptimeNotification', () => {
  it('builds a site_down notification', () => {
    const draft = buildUptimeNotification('down', website);
    expect(draft.type).toBe('site_down');
    expect(draft.websiteId).toBe('site1');
    expect(draft.websiteName).toBe("Joe's Plumbing");
    expect(draft.title).toMatch(/is down/i);
    expect(draft.url).toBe('/dashboard/site1');
  });

  it('builds a site_recovered notification', () => {
    const draft = buildUptimeNotification('recovered', website);
    expect(draft.type).toBe('site_recovered');
    expect(draft.title).toMatch(/back up/i);
    expect(draft.url).toBe('/dashboard/site1');
  });
});

describe('buildContentIssueNotification', () => {
  it('builds a content_issue notification', () => {
    const draft = buildContentIssueNotification('issue', website);
    expect(draft.type).toBe('content_issue');
    expect(draft.title).toMatch(/looks broken/i);
    expect(draft.url).toBe('/dashboard/site1');
  });

  it('builds a content_recovered notification', () => {
    const draft = buildContentIssueNotification('recovered', website);
    expect(draft.type).toBe('content_recovered');
    expect(draft.title).toMatch(/looks normal again/i);
    expect(draft.url).toBe('/dashboard/site1');
  });
});
