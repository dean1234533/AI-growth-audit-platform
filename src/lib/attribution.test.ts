import { describe, expect, it } from 'vitest';
import { decodeAttribution } from './attribution';

function referral(payload: object): string {
  return `?r=${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

describe('decodeAttribution', () => {
  it('decodes a valid outreach referral', () => {
    expect(decodeAttribution(referral({ v: 1, site: 'https://example.com', channel: 'email', leadId: 'abc', leadCollection: 'crmLeads' }))).toEqual({
      version: 1,
      website: 'https://example.com',
      channel: 'email',
      leadId: 'abc',
      leadCollection: 'crmLeads',
    });
  });

  it('rejects invalid, unknown-version, and empty payloads', () => {
    expect(decodeAttribution('?r=not-json')).toBeNull();
    expect(decodeAttribution(referral({ v: 2, site: 'https://example.com' }))).toBeNull();
    expect(decodeAttribution(referral({ v: 1 }))).toBeNull();
  });
});

