import type { Fetcher } from './fetchSite';

export interface SelfFetchEnv {
  /** Cloudflare Service Binding to this same Worker (see wrangler.toml `[[services]]`) — lets
   * the scanner fetch its own hostnames in-process, avoiding the edge-routing 522 a Worker's
   * own `fetch()` can hit when calling its own zone. Absent in local dev / if not provisioned. */
  SELF?: { fetch: Fetcher };
  /** Comma-separated hostnames that belong to this deployment — server-side config, never
   * derived from request input, so a user cannot influence which targets use the binding. */
  SELF_HOSTNAMES?: string;
}

/**
 * Returns the Service Binding's fetcher when `targetUrl`'s host is one of this deployment's
 * own hostnames (exact match only — no substring/suffix matching, so `evil.com` or
 * `notapp.dean-da-dev.co.uk` can never qualify), and the binding is actually available.
 * Returns undefined otherwise, meaning "use the normal public fetch" — every external target
 * is completely unaffected by this function's existence.
 */
export function resolveFetcher(targetUrl: string, env: SelfFetchEnv): Fetcher | undefined {
  if (!env.SELF) return undefined;

  let host: string;
  try {
    host = new URL(targetUrl).host.toLowerCase();
  } catch {
    return undefined;
  }

  const selfHostnames = (env.SELF_HOSTNAMES ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (!selfHostnames.includes(host)) return undefined;

  const binding = env.SELF;
  return (url, init) => binding.fetch(url, init);
}
