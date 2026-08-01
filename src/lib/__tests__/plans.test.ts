import { describe, it, expect } from 'vitest';
import { PLANS, getPlan } from '../plans';
import { PLAN_LIMITS } from '../../server/lib/access';

// Regression test: the Pro plan's marketing/billing copy once said "Up to 10 monitored
// websites" while the actually-enforced limit (src/server/lib/access.ts) was 5 — a real
// discrepancy a paying customer would have hit. plans.ts now derives its numbers from
// access.ts instead of hardcoding a second copy; these tests make sure that never drifts again.
describe('PLANS website limits stay in sync with the enforced access.ts limits', () => {
  it('free plan copy matches the enforced free limit', () => {
    const free = getPlan('free');
    expect(free.websiteLimit).toBe(PLAN_LIMITS.free.maxWebsites);
    expect(free.features.some((f) => f.includes(String(PLAN_LIMITS.free.maxWebsites)))).toBe(true);
  });

  it('pro plan copy matches the enforced pro limit', () => {
    const pro = getPlan('pro');
    expect(pro.websiteLimit).toBe(PLAN_LIMITS.pro.maxWebsites);
    expect(pro.features.some((f) => f.includes(String(PLAN_LIMITS.pro.maxWebsites)))).toBe(true);
  });

  it('no plan hardcodes a website count different from access.ts', () => {
    for (const plan of PLANS) {
      if (plan.id === 'free' || plan.id === 'pro') {
        expect(plan.websiteLimit).toBe(PLAN_LIMITS[plan.id].maxWebsites);
      }
    }
  });
});
