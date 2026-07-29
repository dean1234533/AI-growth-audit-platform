import { buildCategoryScores, buildGrowthEstimate, buildOverallScore } from '../../src/lib/scoring';
import { buildRecommendations } from '../../src/lib/recommendations';
import type { AuditResult, CheckResult } from '../../src/lib/types';
import { fetchAndParse } from '../lib/fetchSite';
import { runSeoChecks } from '../lib/checks/seo';
import { runAccessibilityChecks } from '../lib/checks/accessibility';
import { runMobileChecks } from '../lib/checks/mobile';
import { runTrustChecks } from '../lib/checks/trust';
import { runConversionChecks } from '../lib/checks/conversion';
import { runLocalSeoChecks } from '../lib/checks/localSeo';
import { runPerformanceChecks } from '../lib/checks/performance';
import { enrichRecommendationsWithAi } from '../lib/aiNarrative';

export interface AuditEnv {
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

export async function handleAudit(request: Request, env: AuditEnv): Promise<Response> {
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

  const [perf] = await Promise.all([runPerformanceChecks(targetUrl, env.PAGESPEED_API_KEY)]);
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
  const recommendations = await enrichRecommendationsWithAi(env.AI, baseRecommendations);

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

  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
