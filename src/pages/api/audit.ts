import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { buildCategoryScores, buildGrowthEstimate, buildOverallScore } from '../../lib/scoring';
import { buildRecommendations } from '../../lib/recommendations';
import type { AuditResult, CheckResult } from '../../lib/types';
import { fetchAndParse } from '../../server/lib/fetchSite';
import { runSeoChecks } from '../../server/lib/checks/seo';
import { runAccessibilityChecks } from '../../server/lib/checks/accessibility';
import { runMobileChecks } from '../../server/lib/checks/mobile';
import { runTrustChecks } from '../../server/lib/checks/trust';
import { runConversionChecks } from '../../server/lib/checks/conversion';
import { runLocalSeoChecks } from '../../server/lib/checks/localSeo';
import { runPerformanceChecks } from '../../server/lib/checks/performance';
import { enrichRecommendationsWithAi } from '../../server/lib/aiNarrative';
import { notifyAdmin, type AdminAlertEnv } from '../../server/lib/adminAlert';

export const prerender = false;

interface Env extends AdminAlertEnv {
  PAGESPEED_API_KEY?: string;
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

function normalizeUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const targetUrl = normalizeUrl(body.url ?? '');
  if (!targetUrl) {
    return jsonError('Please enter a valid website URL', 400);
  }

  const warnings: string[] = [];

  const { page, robotsTxt, sitemapXml, error } = await fetchAndParse(targetUrl);
  if (!page) {
    return jsonError(error ?? 'Unable to analyse this website', 422);
  }

  const perf = await runPerformanceChecks(targetUrl, cfEnv.PAGESPEED_API_KEY);
  if (perf.warning) warnings.push(perf.warning);

  const checks: CheckResult[] = [
    ...runSeoChecks(page, robotsTxt, sitemapXml),
    ...perf.checks,
    ...runAccessibilityChecks(page),
    ...runMobileChecks(page),
    ...runTrustChecks(page),
    ...runConversionChecks(page),
    ...runLocalSeoChecks(page),
  ];

  const categories = buildCategoryScores(checks);
  const overallScore = buildOverallScore(categories);
  const growthEstimate = buildGrowthEstimate(categories);

  const failedChecks = checks.filter((c) => !c.passed && c.severity !== 'info');
  const baseRecommendations = buildRecommendations(failedChecks);
  const recommendations = await enrichRecommendationsWithAi(cfEnv.AI, baseRecommendations);

  const result: AuditResult = {
    url: page.finalUrl,
    scannedAt: new Date().toISOString(),
    overallScore,
    categories,
    recommendations,
    growthEstimate,
    meta: {
      pageTitle: page.title,
      partial: warnings.length > 0,
      warnings,
    },
  };

  await notifyAdmin(cfEnv, 'Audit completed', [`${result.url} scored ${overallScore}/100.`]);

  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
};
