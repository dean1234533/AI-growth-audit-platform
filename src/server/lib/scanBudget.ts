import { getFirestoreDocument, updateFirestoreDocument, type ServiceAccount } from './firestore';

/**
 * IMPORTANT — this is a soft, best-effort guard, not a hard Cloudflare usage guarantee.
 *
 * It works by reading a Firestore counter before each render and writing the elapsed time
 * back after. That has real gaps: concurrent requests can both read the same "seconds used
 * so far" before either has written its update (a race, not just a hypothetical), and nothing
 * here talks to Cloudflare's own usage metering — it's an independent, approximate estimate.
 * Never present this as "usage is guaranteed to stay under N minutes/day" anywhere (UI, PDF,
 * docs) — the honest claim is "this scan tries to stay within budget, best-effort."
 *
 * PRIORITY MODEL (added alongside the original single-pool budget): Browser Rendering usage is
 * no longer first-come-first-served. Four priorities share one daily pool, gated in a strict
 * order so a customer's own "Scan Now" can't be starved by cron or public/anonymous traffic —
 * see hasRenderBudget() below for the exact rules, and the Growth Audit architecture report
 * this implements for the full reasoning.
 */

// Confirmed via Cloudflare's current Browser Run docs (developers.cloudflare.com/browser-run/limits/):
// Workers Free includes 10 minutes (600s) of browser time per day. 540s keeps a 60s margin
// under that hard cap, to absorb drift between this self-tracked counter and Cloudflare's own
// real-time metering (which isn't readable from inside a Worker request).
export const TOTAL_SAFE_DAILY_BUDGET_SECONDS = 540;

// A floor that ONLY priority 1 (admin) and priority 2 (customer manual/new-website scans) may
// draw on once the rest of the daily budget is spent. Monitoring (priority 3) and the public
// anonymous audit tool (priority 4) are blocked from touching these last 120s, so a customer
// pressing "Scan Now" late in the day still has a real shot at a rendered audit even if cron or
// public traffic already used the rest. A config constant on purpose (not a literal scattered
// through the gating logic) so it can be retuned later without restructuring anything.
export const PROTECTED_CUSTOMER_RESERVATION_SECONDS = 120;

// The anonymous public audit tool (lead-gen, no login required) gets its own small
// sub-allocation, tracked separately, within the non-reserved pool below — it can never touch
// PROTECTED_CUSTOMER_RESERVATION_SECONDS, and on top of that it has its own per-day cap so a
// burst of public traffic (including ad hoc testing against the public endpoint — the exact
// thing that exhausted the old single-pool budget repeatedly) can't consume the whole
// non-reserved pool before monitoring gets a turn. Set to roughly a quarter of the non-reserved
// pool: enough for the public tool to still give real visitors a genuinely rendered audit most
// of the time, without being able to dominate the day's capacity.
export const PUBLIC_ALLOCATION_SECONDS = 90;

const NON_RESERVED_CEILING_SECONDS = TOTAL_SAFE_DAILY_BUDGET_SECONDS - PROTECTED_CUSTOMER_RESERVATION_SECONDS;

const COLLECTION = 'scanBudget';

/**
 * Who's asking for Browser Rendering, resolved SERVER-SIDE only — never trusted from a client
 * request body (see resolveAuditPriority in auditPriority.ts, and /api/audit.ts's caller-
 * resolution code). Order below is priority order, highest first.
 */
export type AuditPriority = 'admin' | 'customer' | 'monitoring' | 'public';

export type BudgetCheck =
  | { allowed: true }
  | { allowed: false; reason: 'exhausted' | 'budget_unknown' | 'reserved_for_customers' | 'public_allocation_exhausted' };

export type RenderOutcome = 'rendered' | 'static_fallback';

interface PriorityCounts {
  admin?: number;
  customer?: number;
  monitoring?: number;
  public?: number;
}

interface BudgetDoc {
  secondsUsed?: number;
  /** Seconds specifically attributed to priority:'public' — checked against PUBLIC_ALLOCATION_SECONDS, independent of (and included within) secondsUsed. */
  publicSecondsUsed?: number;
  counts?: {
    rendered?: PriorityCounts;
    staticFallback?: PriorityCounts;
    skipped?: PriorityCounts;
  };
  lastSkipReason?: string;
  updatedAt?: unknown;
}

function todayDocId(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC) — a fresh doc, and fresh budget, every day automatically
}

/**
 * Whether there's likely enough daily browser-rendering budget left to attempt a render, FOR
 * THIS PRIORITY specifically.
 *
 * Gating rules, in order:
 * - admin: always allowed. Deliberately unconstrained (this is Dean's own account, used for
 *   testing/verification) — still recorded into secondsUsed for honest observability, just
 *   never the reason a render gets blocked. This does mean heavy admin testing can still push
 *   real usage toward Cloudflare's actual cap, same as before this change — an accepted,
 *   explicit tradeoff, not an oversight.
 * - customer (priority 2 — manual "Scan Now" and new-website initial audits): allowed up to the
 *   FULL daily budget, including the reserved band — this IS the reservation; it exists so
 *   customer scans are never the one priority blocked out early.
 * - monitoring (priority 3 — cron): allowed only below NON_RESERVED_CEILING_SECONDS, i.e. never
 *   allowed to spend into the last 120s reserved for customers.
 * - public (priority 4 — anonymous /api/audit): same non-reserved ceiling as monitoring, PLUS
 *   its own separate PUBLIC_ALLOCATION_SECONDS sub-cap.
 *
 * Fails CLOSED (no budget) when Firestore itself can't be reached, for every priority except
 * admin — see the original module-level reasoning: skipping rendering and falling back to
 * static analysis is the safe direction to fail in when usage can't be reliably confirmed.
 */
export async function hasRenderBudget(serviceAccount: ServiceAccount | null, priority: AuditPriority): Promise<BudgetCheck> {
  if (priority === 'admin') return { allowed: true };
  if (!serviceAccount) return { allowed: false, reason: 'budget_unknown' };
  try {
    const doc = (await getFirestoreDocument(serviceAccount, COLLECTION, todayDocId())) as BudgetDoc | null;
    const secondsUsed = typeof doc?.secondsUsed === 'number' ? doc.secondsUsed : 0;
    const publicSecondsUsed = typeof doc?.publicSecondsUsed === 'number' ? doc.publicSecondsUsed : 0;

    if (priority === 'customer') {
      return secondsUsed < TOTAL_SAFE_DAILY_BUDGET_SECONDS ? { allowed: true } : { allowed: false, reason: 'exhausted' };
    }

    if (priority === 'monitoring') {
      return secondsUsed < NON_RESERVED_CEILING_SECONDS ? { allowed: true } : { allowed: false, reason: 'reserved_for_customers' };
    }

    // public
    if (secondsUsed >= NON_RESERVED_CEILING_SECONDS) return { allowed: false, reason: 'reserved_for_customers' };
    if (publicSecondsUsed >= PUBLIC_ALLOCATION_SECONDS) return { allowed: false, reason: 'public_allocation_exhausted' };
    return { allowed: true };
  } catch (err) {
    console.error('hasRenderBudget: could not read budget — failing closed (skipping render), not claiming budget is enforced:', err);
    return { allowed: false, reason: 'budget_unknown' };
  }
}

/** Records actual browser time used after a render attempt (success or failure alike — a failed render still used real seconds), plus which priority/outcome it was for observability. */
export async function recordRenderUsage(
  serviceAccount: ServiceAccount | null,
  elapsedMs: number,
  priority: AuditPriority,
  outcome: RenderOutcome,
): Promise<void> {
  if (!serviceAccount) return;
  const docId = todayDocId();
  try {
    const doc = (await getFirestoreDocument(serviceAccount, COLLECTION, docId)) as BudgetDoc | null;
    const secondsUsed = (typeof doc?.secondsUsed === 'number' ? doc.secondsUsed : 0) + elapsedMs / 1000;
    const publicSecondsUsed = (typeof doc?.publicSecondsUsed === 'number' ? doc.publicSecondsUsed : 0) + (priority === 'public' ? elapsedMs / 1000 : 0);
    const counts = doc?.counts ?? {};
    const bucketKey = outcome === 'rendered' ? 'rendered' : 'staticFallback';
    const bucket: PriorityCounts = { ...(counts[bucketKey] ?? {}) };
    bucket[priority] = (bucket[priority] ?? 0) + 1;
    await updateFirestoreDocument(serviceAccount, COLLECTION, docId, {
      secondsUsed,
      publicSecondsUsed,
      counts: { ...counts, [bucketKey]: bucket },
      updatedAt: new Date(),
    });
  } catch (err) {
    // Best-effort — see the module-level note. A failed write here means the next budget check
    // may under-count usage, which is a known, accepted gap in this guard, not a silent lie: it
    // never claims precision it doesn't have.
    console.error('recordRenderUsage: failed to record usage (next budget check may under-count):', err);
  }
}

/** Records that a render was SKIPPED due to budget — never attempted at all — distinct from a render that was attempted and then fell back. Doesn't touch secondsUsed (no browser time was actually spent). Purely for admin observability. */
export async function recordBudgetSkip(serviceAccount: ServiceAccount | null, priority: AuditPriority, reason: string): Promise<void> {
  if (!serviceAccount) return;
  const docId = todayDocId();
  try {
    const doc = (await getFirestoreDocument(serviceAccount, COLLECTION, docId)) as BudgetDoc | null;
    const counts = doc?.counts ?? {};
    const skipped: PriorityCounts = { ...(counts.skipped ?? {}) };
    skipped[priority] = (skipped[priority] ?? 0) + 1;
    await updateFirestoreDocument(serviceAccount, COLLECTION, docId, {
      counts: { ...counts, skipped },
      lastSkipReason: `${priority}: ${reason}`,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error('recordBudgetSkip: failed to record skip:', err);
  }
}
