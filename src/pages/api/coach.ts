import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { AuditResult } from '../../lib/types';

export const prerender = false;

interface Env {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface CompetitorSummary {
  name: string;
  score: number;
  previousScore: number | null;
}

/** Summarises a scan (plus optional trend + competitor context) into the compact facts the model needs. */
function summariseAudit(
  audit: AuditResult,
  siteName: string,
  previous?: AuditResult | null,
  competitors?: CompetitorSummary[],
): string {
  const categoryLines = audit.categories.map((c) => `${c.label}: ${c.score}/100 (${c.checks.filter((x) => !x.passed).length} issues)`).join('\n');
  const topRecs = audit.recommendations
    .slice(0, 15)
    .map((r) => `- [${r.severity}/${r.impact} impact/${r.difficulty}/${r.estimatedTime}] ${r.title}: ${r.description}`)
    .join('\n');

  let trendSection = '';
  if (previous) {
    const scoreDelta = audit.overallScore - previous.overallScore;
    const previousIds = new Set(previous.recommendations.map((r) => r.id));
    const currentIds = new Set(audit.recommendations.map((r) => r.id));
    const newIssues = audit.recommendations.filter((r) => !previousIds.has(r.id));
    const resolvedIssues = previous.recommendations.filter((r) => !currentIds.has(r.id));
    trendSection = `\n\nSince the last scan (${previous.scannedAt}, score ${previous.overallScore}/100):
Score change: ${scoreDelta > 0 ? '+' : ''}${scoreDelta}
New issues: ${newIssues.map((r) => r.title).join('; ') || 'none'}
Resolved issues: ${resolvedIssues.map((r) => r.title).join('; ') || 'none'}`;
  }

  let competitorSection = '';
  if (competitors && competitors.length > 0) {
    const lines = competitors.map((c) => {
      const trend = c.previousScore !== null ? ` (was ${c.previousScore})` : '';
      return `- ${c.name}: ${c.score}/100${trend}`;
    });
    competitorSection = `\n\nCompetitors being tracked:\n${lines.join('\n')}`;
  }

  return `Website: ${siteName} (${audit.url})
Last scanned: ${audit.scannedAt}
Overall score: ${audit.overallScore}/100

Category scores:
${categoryLines}

Detected issues (priority order):
${topRecs}${trendSection}${competitorSection}`;
}

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;
  if (!cfEnv.AI) return jsonError('AI coach is not available right now.', 503);

  let body: {
    question?: string;
    siteName?: string;
    audit?: AuditResult;
    previous?: AuditResult | null;
    competitors?: CompetitorSummary[];
    history?: { role: 'user' | 'assistant'; content: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const question = (body.question ?? '').trim();
  if (!question || !body.audit) {
    return jsonError('A question and audit data are required', 400);
  }

  const dataSummary = summariseAudit(body.audit, body.siteName ?? body.audit.url, body.previous, body.competitors);
  const history = (body.history ?? []).slice(-6);

  try {
    const result = await cfEnv.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'You are an AI website growth coach. You must answer ONLY using the website data provided below — never give generic SEO advice not grounded in this specific data. If the data does not contain enough information to answer, say so plainly rather than inventing something. Keep answers concise (3-6 sentences, or a short bullet list), specific, and reference actual detected issues, scores or categories by name. Speak directly to the business owner, plain English, no jargon.\n\n' +
            dataSummary,
        },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: question },
      ],
      max_tokens: 500,
    });

    const answer = result?.response?.trim();
    if (!answer) return jsonError('The coach could not generate an answer. Please try again.', 502);

    return new Response(JSON.stringify({ answer }), { headers: { 'content-type': 'application/json' } });
  } catch {
    return jsonError('The coach could not generate an answer. Please try again.', 502);
  }
};
