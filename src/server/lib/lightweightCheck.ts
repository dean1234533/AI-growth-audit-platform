import type { Fetcher } from './fetchSite';

const CHECK_TIMEOUT_MS = 6000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GrowthAuditBot/1.0; +https://growthaudit.app)';
// A homepage this large is already far past anything a "did the content collapse" comparison
// needs — capped so a check never has to read an unbounded response body.
const MAX_BODY_CHARS = 500_000;

export interface ReachabilityResult {
  up: boolean;
  status: number | null;
  /** <title> text, or null if unreachable/no title found. */
  title: string | null;
  /** Visible-text length after stripping tags — a cheap proxy for "how much content is on this
   * page," used by the content-drift check in runLightweightChecks.ts. 0 if unreachable. */
  contentLength: number;
}

/**
 * A deliberately minimal "is the server alive, and does the page still look like itself" check
 * for the 15-minute uptime cron pass — distinct from runFullAudit's homepage.status < 200 ||
 * >= 300 error-page guard, which cares whether a page is real content worth scoring. Here, any
 * response at all (even a 404) proves the server is up and responding; only a network
 * failure/timeout or a 5xx server error counts as down. Always GETs (rather than HEAD) because
 * the caller needs the body to compare title/content length against the site's last known-good
 * snapshot — see runLightweightChecks.ts's content-drift detection, which catches a hacked/
 * defaced/blanked page that still returns 200 OK and would otherwise look perfectly "up."
 */
export async function checkSiteReachable(url: string, fetcher?: Fetcher): Promise<ReachabilityResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const fetchImpl = fetcher ?? fetch;
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
    const html = (await res.text().catch(() => '')).slice(0, MAX_BODY_CHARS);
    return { up: res.status < 500, status: res.status, title: extractTitle(html), contentLength: stripTags(html).length };
  } catch {
    return { up: false, status: null, title: null, contentLength: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = match?.[1]?.trim();
  return text ? text : null;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
