import type { PlanId } from './userSettings';
import { PLAN_LIMITS } from '../server/lib/access';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string;
  websiteLimit: number | null;
  features: string[];
}

// Website-limit numbers come from src/server/lib/access.ts (the single source of truth the
// actual enforcement reads from) — never hardcode a limit here, or the marketing/billing copy
// can drift out of sync with what's actually enforced server-side, as it previously did (this
// page said "up to 10" while the real enforced Pro limit was 5).
const FREE_LIMIT = PLAN_LIMITS.free.maxWebsites;
const PRO_LIMIT = PLAN_LIMITS.pro.maxWebsites;

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    price: '£0',
    websiteLimit: FREE_LIMIT,
    features: [`${FREE_LIMIT} monitored website`, 'Weekly scans', 'AI Coach', 'Push notifications'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '£5/mo',
    websiteLimit: PRO_LIMIT,
    features: [
      `Up to ${PRO_LIMIT} monitored websites`,
      'Daily scans',
      'Competitor monitoring',
      'AI Coach',
      'Push notifications + weekly AI reports',
    ],
  },
];

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
