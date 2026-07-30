import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { WeeklyDigest } from '../../lib/reports';

export const prerender = false;

interface Env {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json' } });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function digestToFacts(digest: WeeklyDigest): string {
  const deltaText =
    digest.scoreDelta === null
      ? 'This is the first scan on record.'
      : digest.scoreDelta === 0
        ? 'The score has not changed since the last scan.'
        : `The score ${digest.scoreDelta > 0 ? 'increased' : 'decreased'} from ${digest.previousScore} to ${digest.currentScore} (${digest.scoreDelta > 0 ? '+' : ''}${digest.scoreDelta}).`;

  return `Site: ${digest.siteName} (${digest.siteUrl})
Current score: ${digest.currentScore}/100
${deltaText}
Resolved since last scan: ${digest.resolvedIssues.map((r) => r.title).join('; ') || 'none'}
New issues since last scan: ${digest.newIssues.map((r) => r.title).join('; ') || 'none'}
Top priority right now: ${digest.topPriority ? `${digest.topPriority.title} — ${digest.topPriority.description}` : 'none'}`;
}

/** A short conversational narrative for the top of a weekly report — grounded in the same digest data the report itself renders. */
export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;

  let body: { digest?: WeeklyDigest; userName?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }
  if (!body.digest) return jsonError('A digest is required', 400);

  const name = body.userName?.trim();
  const salutation = `${greeting()}${name ? `, ${name}` : ''} 👋`;

  if (!cfEnv.AI) {
    // Deterministic fallback if Workers AI isn't available — still real data, just not prose-polished.
    const d = body.digest;
    const scoreLine =
      d.scoreDelta === null
        ? `Your first scan of ${d.siteName} is in — you're starting at ${d.currentScore}/100.`
        : `Your website health has ${d.scoreDelta >= 0 ? 'increased' : 'decreased'} from ${d.previousScore} to ${d.currentScore}.`;
    return new Response(JSON.stringify({ summary: `${salutation} ${scoreLine}` }), { headers: { 'content-type': 'application/json' } });
  }

  try {
    const result = await cfEnv.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            `You write the opening line of a weekly website health report, in the voice of a friendly AI coach speaking directly to the site owner. ` +
            `Start with exactly this salutation: "${salutation}". Then write 2-4 short sentences using ONLY the facts below — no invented numbers, no generic advice. ` +
            `Mention the score and its change, and name the single most important thing to do next if there is a top priority. Plain English, warm but concise, no headers or bullet points.\n\n` +
            digestToFacts(body.digest),
        },
        { role: 'user', content: 'Write the summary.' },
      ],
      max_tokens: 220,
    });

    const summary = result?.response?.trim();
    if (!summary) throw new Error('empty response');
    return new Response(JSON.stringify({ summary }), { headers: { 'content-type': 'application/json' } });
  } catch {
    const d = body.digest;
    const scoreLine =
      d.scoreDelta === null
        ? `Your first scan of ${d.siteName} is in — you're starting at ${d.currentScore}/100.`
        : `Your website health has ${d.scoreDelta >= 0 ? 'increased' : 'decreased'} from ${d.previousScore} to ${d.currentScore}.`;
    return new Response(JSON.stringify({ summary: `${salutation} ${scoreLine}` }), { headers: { 'content-type': 'application/json' } });
  }
};
