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
    // AI Coach is enforced Pro-only server-side (src/pages/api/coach.ts, via canUseAiCoach() in
    // src/server/lib/access.ts) — kept off this list so the Free/Pro difference reads clearly.
    features: [`${FREE_LIMIT} monitored website`, 'Weekly scans', 'Website health tracking', 'Push notifications'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '£5/mo',
    websiteLimit: PRO_LIMIT,
    // Every feature below is now actually enforced, not just marketing copy:
    //  - website count: src/pages/api/websites.ts (canAddWebsite)
    //  - "Daily scans": src/pages/api/websites.ts on create + firestore.rules on update
    //    (canUseDailyScans / isProOrAdmin() — the settings UI writes frequency directly to
    //    Firestore with no API route, so the rule is the only enforcement point for changes)
    //  - "Instant downtime alerts": cron/runLightweightChecks.ts (canUseInstantAlerts) — a
    //    separate 15-minute Cron Trigger, not gated via an API route or Firestore rule since
    //    it's never client-initiated
    //  - "Competitor monitoring": firestore.rules `create` on websites/{id}/competitors
    //    (isProOrAdmin() — same reason, no API route exists for this write)
    //  - "AI Coach": src/pages/api/coach.ts (canUseAiCoach)
    //  - "Weekly AI reports": src/pages/api/report-summary.ts (canUseAiReports) — note this only
    //    gates who gets the AI-written narrative; it doesn't actually run on a weekly schedule,
    //    it's generated on-demand whenever ReportsSection.tsx is viewed.
    features: [
      `Up to ${PRO_LIMIT} monitored websites`,
      'Daily scans',
      'Instant downtime alerts',
      'Competitor monitoring',
      'AI Coach',
      'Push notifications',
      'Weekly AI reports',
    ],
  },
];

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
