import type { Recommendation } from '../../src/lib/types';

interface WorkersAiBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }>;
}

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

/**
 * Rewrites the title/description of each recommendation into specific, business-owner-friendly
 * wording via Cloudflare Workers AI, referencing the real detected detail. Falls back silently
 * to the original deterministic text (already business-friendly) if the AI call fails or the
 * response can't be parsed, so the report never breaks.
 */
export async function enrichRecommendationsWithAi(ai: WorkersAiBinding | undefined, recommendations: Recommendation[]): Promise<Recommendation[]> {
  if (!ai || recommendations.length === 0) return recommendations;

  const top = recommendations.slice(0, 12);
  const rest = recommendations.slice(12);

  const prompt = buildPrompt(top);

  try {
    const result = await ai.run(MODEL, {
      messages: [
        {
          role: 'system',
          content:
            'You are a website growth consultant writing a report for a non-technical small business owner. Rewrite each issue into a short, specific, plain-English title (max 8 words) and a 1-2 sentence description that references the exact detected detail given. Never use generic advice. Respond ONLY with a JSON array, same order as input, each item: {"id": string, "title": string, "description": string}. No markdown, no commentary.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1200,
    });

    const text = result?.response ?? '';
    const parsed = extractJsonArray(text);
    if (!parsed) return recommendations;

    const byId = new Map(parsed.map((p) => [p.id, p]));
    const enrichedTop = top.map((rec) => {
      const ai = byId.get(rec.id);
      if (!ai || !ai.title || !ai.description) return rec;
      return { ...rec, title: ai.title, description: ai.description, aiGenerated: true };
    });

    return [...enrichedTop, ...rest];
  } catch {
    return recommendations;
  }
}

function buildPrompt(recs: Recommendation[]): string {
  const lines = recs.map((r) => `- id: ${r.id} | issue: ${r.title} | detected detail: ${r.description}`);
  return `Here are the detected issues:\n${lines.join('\n')}`;
}

function extractJsonArray(text: string): { id: string; title: string; description: string }[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
