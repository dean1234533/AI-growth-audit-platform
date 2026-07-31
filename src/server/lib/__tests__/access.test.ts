import { describe, it, expect } from 'vitest';
import { canAddWebsite, resolvePlanId, websiteLimitMessage, buildWebsiteQuota, getPlanLimits } from '../access';

describe('getPlanLimits', () => {
  it('free plan: maxWebsites 1, not unlimited', () => {
    expect(getPlanLimits('free')).toEqual({ maxWebsites: 1, unlimited: false });
  });

  it('paid (pro) plan: maxWebsites 5, not unlimited', () => {
    expect(getPlanLimits('pro')).toEqual({ maxWebsites: 5, unlimited: false });
  });

  it('admin: maxWebsites null, unlimited', () => {
    expect(getPlanLimits('admin')).toEqual({ maxWebsites: null, unlimited: true });
  });
});

describe('canAddWebsite — FREE', () => {
  it('0 → can add', () => expect(canAddWebsite('free', 0)).toBe(true));
  it('1 → cannot add another (2nd website rejected)', () => expect(canAddWebsite('free', 1)).toBe(false));
});

describe('canAddWebsite — PAID', () => {
  it('0 → can add', () => expect(canAddWebsite('pro', 0)).toBe(true));
  it('1 → can add', () => expect(canAddWebsite('pro', 1)).toBe(true));
  it('2 → can add', () => expect(canAddWebsite('pro', 2)).toBe(true));
  it('3 → can add', () => expect(canAddWebsite('pro', 3)).toBe(true));
  it('4 → can add (5th website allowed)', () => expect(canAddWebsite('pro', 4)).toBe(true));
  it('5 → cannot add another (6th website rejected)', () => expect(canAddWebsite('pro', 5)).toBe(false));
});

describe('canAddWebsite — ADMIN', () => {
  it('0 → can add', () => expect(canAddWebsite('admin', 0)).toBe(true));
  it('1 → can add', () => expect(canAddWebsite('admin', 1)).toBe(true));
  it('5 → can add (more than paid limit)', () => expect(canAddWebsite('admin', 5)).toBe(true));
  it('10 → can add', () => expect(canAddWebsite('admin', 10)).toBe(true));
  it('100 → can add — no practical limit imposed', () => expect(canAddWebsite('admin', 100)).toBe(true));
});

describe('resolvePlanId', () => {
  it('the admin email resolves to admin regardless of billing plan', () => {
    expect(resolvePlanId('deanburt1308@gmail.com', 'free')).toBe('admin');
    expect(resolvePlanId('deanburt1308@gmail.com', null)).toBe('admin');
  });

  it('a non-admin email with billingPlan "pro" resolves to pro', () => {
    expect(resolvePlanId('someone@example.com', 'pro')).toBe('pro');
  });

  it('a non-admin email with no/other billingPlan defaults to free', () => {
    expect(resolvePlanId('someone@example.com', null)).toBe('free');
    expect(resolvePlanId('someone@example.com', 'something-unexpected')).toBe('free');
  });

  it('an email that merely contains the admin address as a substring is not treated as admin', () => {
    expect(resolvePlanId('notdeanburt1308@gmail.com', 'free')).toBe('free');
    expect(resolvePlanId('deanburt1308@gmail.com.evil.com', 'free')).toBe('free');
  });
});

describe('websiteLimitMessage', () => {
  it('free: exact required copy', () => {
    expect(websiteLimitMessage('free')).toBe('You can have 1 website on the Free plan. Upgrade to monitor up to 5 websites.');
  });

  it('paid: exact required copy', () => {
    expect(websiteLimitMessage('pro')).toBe('You can have up to 5 websites on your current plan.');
  });

  it('admin: never shows a limit warning', () => {
    expect(websiteLimitMessage('admin')).toBeNull();
  });
});

describe('buildWebsiteQuota', () => {
  it('free user with 1 website: "1 / 1 websites" shape, cannot add, limit message present', () => {
    const quota = buildWebsiteQuota('free', 1);
    expect(quota).toEqual({
      planId: 'free',
      currentCount: 1,
      maxWebsites: 1,
      unlimited: false,
      canAdd: false,
      limitMessage: 'You can have 1 website on the Free plan. Upgrade to monitor up to 5 websites.',
    });
  });

  it('paid user with 3 websites: "3 / 5 websites" shape, can still add', () => {
    const quota = buildWebsiteQuota('pro', 3);
    expect(quota.currentCount).toBe(3);
    expect(quota.maxWebsites).toBe(5);
    expect(quota.canAdd).toBe(true);
    expect(quota.limitMessage).toBeNull();
  });

  it('admin: unlimited, never blocked, no limit message no matter the count', () => {
    const quota = buildWebsiteQuota('admin', 250);
    expect(quota.unlimited).toBe(true);
    expect(quota.maxWebsites).toBeNull();
    expect(quota.canAdd).toBe(true);
    expect(quota.limitMessage).toBeNull();
  });
});
