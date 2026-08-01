/**
 * Adapts a user-supplied Gemini API key to the same shape as the Cloudflare Workers AI binding
 * (`{ run(model, input): Promise<{ response?: string }> }`) already used throughout the codebase
 * (aiNarrative.ts, coach.ts, report-summary.ts) — so callers can swap in a user's own Gemini key
 * without changing any of those call sites' logic, only which "ai" object they pass in.
 */
import { getFirestoreDocument, type ServiceAccount } from './firestore';

// Source: https://ai.google.dev/gemini-api/docs/models (checked 2026-08 — update here if Google
// deprecates this model; the API returns a normal error in that case, handled by callers' existing
// try/catch fallback to Workers AI / deterministic text, so a stale model id fails safely).
const GEMINI_MODEL = 'gemini-3.6-flash';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RunInput {
  messages?: ChatMessage[];
  max_tokens?: number;
}

export interface AiRunner {
  run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }>;
}

function toGeminiContents(messages: ChatMessage[]): { systemInstruction?: { parts: { text: string }[] }; contents: { role: string; parts: { text: string }[] }[] } {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  return {
    ...(systemParts.length > 0 ? { systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] } } : {}),
    contents,
  };
}

/**
 * Creates an `AiRunner` backed by a specific user's own Gemini API key, ignoring the `model`
 * argument callers pass (that's a Workers AI model id) in favour of GEMINI_MODEL. Sends the key
 * via the `x-goog-api-key` header (Google's documented alternative to the `?key=` query param)
 * so it never appears in a request URL, which is more likely to end up in logs/observability
 * tooling than a header. On failure, throws — mirroring Workers AI's own rejected-promise
 * failure mode, so existing try/catch fallback logic at every call site (aiNarrative.ts,
 * coach.ts, report-summary.ts) keeps working unmodified — but the thrown error's message is
 * built only from Google's response status/body, which never contains the submitted key.
 */
export function createGeminiRunner(apiKey: string): AiRunner {
  return {
    async run(_model: string, input: Record<string, unknown>): Promise<{ response?: string }> {
      const { messages = [], max_tokens: maxTokens } = input as RunInput;
      const { systemInstruction, contents } = toGeminiContents(messages);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          ...(systemInstruction ? { systemInstruction } : {}),
          contents,
          generationConfig: {
            ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
            // gemini-3.6-flash's internal "thinking" tokens count against maxOutputTokens —
            // confirmed live (73 thinking tokens for a 1-word prompt) truncating real answers
            // to nothing before any visible text was produced. minimal thinking keeps the
            // model's actual latency/quality for these short, grounded, non-code-reasoning
            // tasks (Coach answers, recommendation write-ups, digest lines) while leaving the
            // token budget for the answer itself.
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // Defensive redaction — Google's own error bodies don't echo the key back, but this
        // guarantees it regardless, since this message can end up in a caught error's .message.
        const safeText = text.split(apiKey).join('[REDACTED]');
        throw new Error(`Gemini API request failed: ${res.status} ${safeText}`);
      }

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      return { response: text };
    },
  };
}

/**
 * Reads a user's own Gemini API key from its write-only-from-the-client Firestore location
 * (users/{uid}/secrets/gemini — see firestore.rules) via the trusted service account, which
 * bypasses the `allow read: if false` rule that blocks every other reader, including the owner.
 * Returns undefined (never throws) if unset or on any lookup failure — callers treat that as
 * "use the shared AI instead," never as an error.
 */
export async function getStoredGeminiKey(serviceAccount: ServiceAccount, uid: string): Promise<string | undefined> {
  const doc = await getFirestoreDocument(serviceAccount, `users/${uid}/secrets`, 'gemini').catch(() => null);
  const key = typeof doc?.apiKey === 'string' ? doc.apiKey.trim() : '';
  return key || undefined;
}

/** The last 4 characters of a user's stored key, for the masked "•••• last4" Settings display —
 * never the full key. Returns null if no key is set. */
export async function getGeminiKeyLast4(serviceAccount: ServiceAccount, uid: string): Promise<string | null> {
  const key = await getStoredGeminiKey(serviceAccount, uid);
  return key ? key.slice(-4) : null;
}
