import type { PlanId } from './userSettings';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: string;
  websiteLimit: number | null;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    price: '£0',
    websiteLimit: 1,
    features: ['1 monitored website', 'Weekly scans', 'AI SEO Coach', 'Push notifications'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '£14/mo',
    websiteLimit: 10,
    features: [
      'Up to 10 monitored websites',
      'Daily scans',
      'Competitor monitoring',
      'AI SEO Coach',
      'Push notifications + weekly AI reports',
    ],
  },
];

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
