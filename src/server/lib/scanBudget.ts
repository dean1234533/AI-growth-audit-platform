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
 */
const DAILY_BUDGET_SECONDS = 9 * 60; // Reserve a margin under Workers Free's 10 min/day cap.
const COLLECTION = 'scanBudget';

export type BudgetCheck =
  | { allowed: true }
  | { allowed: false; reason: 'exhausted' | 'budget_unknown' };

function todayDocId(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC) — a fresh doc, and fresh budget, every day automatically
}

/**
 * Whether there's likely enough daily browser-rendering budget left to attempt a render.
 *
 * Fails CLOSED (no budget) when Firestore itself can't be reached — deliberately, not as an
 * oversight. The alternative (failing open) would mean a Firestore outage silently removes
 * the only guard against unbounded, repeated, expensive browser-session launches for as long
 * as the outage lasts — exactly the "don't repeatedly launch expensive sessions when budget
 * can't be reliably enforced" failure mode to avoid. Skipping rendering and falling back to
 * static analysis is the safe direction to fail in; the reverse isn't.
 */
export async function hasRenderBudget(serviceAccount: ServiceAccount | null): Promise<BudgetCheck> {
  if (!serviceAccount) return { allowed: false, reason: 'budget_unknown' };
  try {
    const doc = await getFirestoreDocument(serviceAccount, COLLECTION, todayDocId());
    const secondsUsed = typeof doc?.secondsUsed === 'number' ? doc.secondsUsed : 0;
    return secondsUsed < DAILY_BUDGET_SECONDS ? { allowed: true } : { allowed: false, reason: 'exhausted' };
  } catch (err) {
    console.error('hasRenderBudget: could not read budget — failing closed (skipping render), not claiming budget is enforced:', err);
    return { allowed: false, reason: 'budget_unknown' };
  }
}

/** Records actual browser time used after a render attempt (success or failure alike — a failed render still used some seconds). */
export async function recordRenderUsage(serviceAccount: ServiceAccount | null, elapsedMs: number): Promise<void> {
  if (!serviceAccount) return;
  const docId = todayDocId();
  try {
    const doc = await getFirestoreDocument(serviceAccount, COLLECTION, docId);
    const secondsUsed = (typeof doc?.secondsUsed === 'number' ? doc.secondsUsed : 0) + elapsedMs / 1000;
    await updateFirestoreDocument(serviceAccount, COLLECTION, docId, { secondsUsed, updatedAt: new Date() });
  } catch (err) {
    // Best-effort — see the module-level note. A failed write here means the next check may
    // under-count usage, which is a known, accepted gap in this guard, not a silent lie: it
    // never claims precision it doesn't have.
    console.error('recordRenderUsage: failed to record usage (next budget check may under-count):', err);
  }
}
