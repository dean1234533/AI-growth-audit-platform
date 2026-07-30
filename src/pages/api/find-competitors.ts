import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { findCompetitors, buildCompetitorSearchQuery } from '../../server/lib/competitorSearch';

export const prerender = false;

interface Env {
  BRAVE_SEARCH_API_KEY?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * Suggests real competing websites via a Brave web search grounded in the audited site's own
 * page title (no auth required — this only reads publicly-visible page-title text the caller
 * already has from their own audit, and touches no per-user Firestore data).
 */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  if (!cfEnv.BRAVE_SEARCH_API_KEY) return jsonError('Competitor discovery is not configured yet.', 503);

  let body: { siteUrl?: string; pageTitle?: string | null };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }
  if (!body.siteUrl) return jsonError('siteUrl is required', 400);

  let hostname: string;
  try {
    hostname = new URL(body.siteUrl).hostname.replace(/^www\./, '');
  } catch {
    return jsonError('Invalid siteUrl', 400);
  }

  try {
    const searchQuery = await buildCompetitorSearchQuery(cfEnv.AI, body.pageTitle ?? null, hostname);
    const suggestions = await findCompetitors(cfEnv.BRAVE_SEARCH_API_KEY, searchQuery, hostname);
    return new Response(JSON.stringify({ suggestions, searchQuery }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('find-competitors failed:', err);
    return jsonError('Could not find competitors right now. Please try again.', 502);
  }
};
