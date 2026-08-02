import type { RenderedPageData } from './renderPage';

/**
 * Module-scope, best-effort in-flight-render map — persists for the lifetime of this Worker
 * isolate. Cloudflare may reuse an isolate across multiple requests, but does NOT guarantee
 * concurrent requests land on the same isolate/PoP, so this is deliberately NOT presented as a
 * distributed lock. It catches the common, real case (two near-simultaneous requests for the
 * same URL handled by the same warm isolate) without inventing cross-isolate coordination
 * infrastructure for what's a rare, low-stakes race — worst case without a shared isolate is
 * simply today's pre-existing behaviour (two independent renders).
 */
const inFlightRenders = new Map<string, Promise<RenderedPageData | null>>();

/** Normalizes protocol/hostname/trailing-slash so `https://Example.com/` and `https://example.com` dedup to the same key. Falls back to the raw (lowercased, trimmed) string if the URL can't be parsed — dedup simply won't fire for that request, never a crash. */
export function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Shares an in-progress render — NOT the whole audit response — across concurrent requests for
 * the same normalized URL, so two people auditing the same site at the same moment don't each
 * launch their own Browser Rendering session. Deliberately scoped to just the render: the
 * `RenderedPageData` it returns is derived entirely from the target site's own public page (DOM
 * text, forms, buttons, headings) and carries no caller-specific data (no uid, no business
 * context, no AI-generated recommendations) — those are computed per-request in runFullAudit.ts
 * from this shared render, so no user's private audit data can leak to another user through
 * this cache. If the underlying URL ever needed session-specific rendering (it doesn't today),
 * this function would need to key on more than just the URL — worth remembering if that changes.
 *
 * `isNew` tells the caller whether THIS call actually started the render (and should record
 * budget usage) or joined an existing in-flight one (whose usage is already being recorded by
 * whichever call started it) — required to avoid double-counting one real render as two against
 * the daily budget.
 */
export function dedupedRender(
  key: string,
  factory: () => Promise<RenderedPageData | null>,
): { promise: Promise<RenderedPageData | null>; isNew: boolean } {
  const existing = inFlightRenders.get(key);
  if (existing) return { promise: existing, isNew: false };

  const promise = factory().finally(() => {
    inFlightRenders.delete(key);
  });
  inFlightRenders.set(key, promise);
  return { promise, isNew: true };
}
