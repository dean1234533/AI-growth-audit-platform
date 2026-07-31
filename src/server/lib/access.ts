/**
 * Single source of truth for plan-based access limits. Every place that needs to know "how
 * many websites can this user monitor" — the website-creation route, the quota-display route,
 * tests — reads from here. Nothing else in the codebase should hardcode 1 / 5 / unlimited.
 */

export type PlanId = 'free' | 'pro' | 'admin';

export interface PlanLimits {
  /** Maximum number of monitored websites. null means no limit (only ever true for admin). */
  maxWebsites: number | null;
  unlimited: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { maxWebsites: 1, unlimited: false },
  pro: { maxWebsites: 5, unlimited: false },
  admin: { maxWebsites: null, unlimited: true },
};

/**
 * The one initial admin identity. This exists only because the project has no proper
 * server-side role/claim system yet (this Workers runtime has no firebase-admin SDK, so there's
 * no `setCustomUserClaims` support — see verifyFirebaseIdToken.ts). Admin status is still
 * resolved server-side from a cryptographically-verified ID token's email claim, never from
 * anything the client asserts about itself, so it can't be spoofed by a request body. If this
 * project grows past one admin, replace this with real custom claims rather than adding emails
 * to this list.
 */
const ADMIN_EMAIL = 'deanburt1308@gmail.com';

/**
 * Resolves the effective plan for access-control purposes. `verifiedEmail` must come from a
 * server-verified ID token (never trust a client-supplied email). `billingPlan` must come from
 * the user's Firestore doc (`users/{uid}.plan`, itself only ever writable by the Stripe webhook's
 * service account — see firestore.rules) — never from the request body.
 */
export function resolvePlanId(verifiedEmail: string | null | undefined, billingPlan: string | null | undefined): PlanId {
  if (verifiedEmail && verifiedEmail === ADMIN_EMAIL) return 'admin';
  return billingPlan === 'pro' ? 'pro' : 'free';
}

export function getPlanLimits(planId: PlanId): PlanLimits {
  return PLAN_LIMITS[planId];
}

/** Whether a user on `planId` who already monitors `currentWebsiteCount` websites may add one more. */
export function canAddWebsite(planId: PlanId, currentWebsiteCount: number): boolean {
  const limits = getPlanLimits(planId);
  if (limits.unlimited) return true;
  return currentWebsiteCount < (limits.maxWebsites ?? 0);
}

/** User-facing copy for the "Website limit reached" state. Returns null for admin (never shown a limit warning). */
export function websiteLimitMessage(planId: PlanId): string | null {
  switch (planId) {
    case 'free':
      return 'You can have 1 website on the Free plan. Upgrade to monitor up to 5 websites.';
    case 'pro':
      return 'You can have up to 5 websites on your current plan.';
    case 'admin':
      return null;
  }
}

export interface WebsiteQuota {
  planId: PlanId;
  currentCount: number;
  maxWebsites: number | null;
  unlimited: boolean;
  canAdd: boolean;
  /** Set only when canAdd is false — the exact copy to show for "Website limit reached". */
  limitMessage: string | null;
}

export function buildWebsiteQuota(planId: PlanId, currentCount: number): WebsiteQuota {
  const limits = getPlanLimits(planId);
  const canAdd = canAddWebsite(planId, currentCount);
  return {
    planId,
    currentCount,
    maxWebsites: limits.maxWebsites,
    unlimited: limits.unlimited,
    canAdd,
    limitMessage: canAdd ? null : websiteLimitMessage(planId),
  };
}
