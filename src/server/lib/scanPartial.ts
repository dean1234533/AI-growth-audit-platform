/**
 * Whether a scan should be reported as partial. A full scan (crawlPages) expects real
 * browser-rendered analysis; if rendering never completed — for any reason (missing binding,
 * budget, or a genuine failure) — some checks fell back to static analysis and the scan is
 * meaningfully less complete than a normal run. Lightweight scans (crawlPages: false, e.g.
 * competitor checks) never attempt rendering by design, so a missing `rendered` there is
 * normal, not partial. PageSpeed Insights warnings independently mark a scan partial too.
 */
export function computeScanPartial(warnings: string[], crawlPages: boolean, rendered: unknown): boolean {
  return warnings.length > 0 || (crawlPages && !rendered);
}
