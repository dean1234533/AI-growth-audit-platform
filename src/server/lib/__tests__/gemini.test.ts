import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGeminiRunner, getStoredGeminiKey, getGeminiKeyLast4 } from '../gemini';
import * as firestoreModule from '../firestore';

const sa = { client_email: 'x', private_key: 'y', project_id: 'test-project' };

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('createGeminiRunner', () => {
  it('sends the API key via the x-goog-api-key header, never in the URL or request body', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] }), { status: 200 }),
    );

    const runner = createGeminiRunner('secret-key-123');
    await runner.run('ignored-model', { messages: [{ role: 'user', content: 'hi' }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('secret-key-123');
    expect((init?.headers as Record<string, string>)?.['x-goog-api-key']).toBe('secret-key-123');
    expect(JSON.stringify(init?.body ?? '')).not.toContain('secret-key-123');
  });

  it('redacts the key from a thrown error message even if Google\'s error body somehow echoed it back', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(new Response('error mentioning secret-key-123 somehow', { status: 400 }));

    const runner = createGeminiRunner('secret-key-123');
    await expect(runner.run('m', { messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/\[REDACTED\]/);
    try {
      await runner.run('m', { messages: [{ role: 'user', content: 'hi' }] });
    } catch (err) {
      expect((err as Error).message).not.toContain('secret-key-123');
    }
  });

  it('splits a system message into systemInstruction, separate from contents', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }));

    const runner = createGeminiRunner('key');
    await runner.run('m', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Question?' },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('You are a helpful assistant.');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'Question?' }] }]);
  });

  it('maps assistant history to Gemini\'s "model" role', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }));

    const runner = createGeminiRunner('key');
    await runner.run('m', {
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('returns the generated text as { response }', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Generated answer.' }] } }] }), { status: 200 }),
    );

    const runner = createGeminiRunner('key');
    const result = await runner.run('m', { messages: [{ role: 'user', content: 'hi' }] });
    expect(result.response).toBe('Generated answer.');
  });

  it('sets thinkingLevel to minimal, so internal reasoning tokens never eat into the visible answer\'s token budget', async () => {
    // Regression test: confirmed live against the real API that gemini-3.6-flash's default
    // thinking mode spent 73 tokens "thinking" about a 1-word prompt, truncating real Coach/
    // report-summary answers to nothing within their maxOutputTokens budget.
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }));

    const runner = createGeminiRunner('key');
    await runner.run('m', { messages: [{ role: 'user', content: 'hi' }], max_tokens: 220 });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    expect(body.generationConfig.maxOutputTokens).toBe(220);
  });

  it('throws on a non-OK response, so existing try/catch fallback logic at call sites still works', async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(new Response('invalid key', { status: 401 }));

    const runner = createGeminiRunner('bad-key');
    await expect(runner.run('m', { messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow();
  });
});

describe('getStoredGeminiKey / getGeminiKeyLast4', () => {
  it('reads the key from users/{uid}/secrets/gemini via the service account (bypassing the client-facing read:false rule)', async () => {
    const spy = vi.spyOn(firestoreModule, 'getFirestoreDocument').mockResolvedValue({ apiKey: 'real-key-abcd' });
    const key = await getStoredGeminiKey(sa, 'uid-1');
    expect(spy).toHaveBeenCalledWith(sa, 'users/uid-1/secrets', 'gemini');
    expect(key).toBe('real-key-abcd');
    spy.mockRestore();
  });

  it('returns undefined, not an empty string or error, when no key is set', async () => {
    const spy = vi.spyOn(firestoreModule, 'getFirestoreDocument').mockResolvedValue(null);
    const key = await getStoredGeminiKey(sa, 'uid-1');
    expect(key).toBeUndefined();
    spy.mockRestore();
  });

  it('never throws on a lookup failure — returns undefined so callers fall back to the shared AI', async () => {
    const spy = vi.spyOn(firestoreModule, 'getFirestoreDocument').mockRejectedValue(new Error('network error'));
    const key = await getStoredGeminiKey(sa, 'uid-1');
    expect(key).toBeUndefined();
    spy.mockRestore();
  });

  it('getGeminiKeyLast4 returns only the last 4 characters, never the full key', async () => {
    const spy = vi.spyOn(firestoreModule, 'getFirestoreDocument').mockResolvedValue({ apiKey: 'AIzaSyD0-real-looking-key-1234' });
    const last4 = await getGeminiKeyLast4(sa, 'uid-1');
    expect(last4).toBe('1234');
    expect(last4).not.toContain('AIzaSyD0');
    spy.mockRestore();
  });

  it('getGeminiKeyLast4 returns null when no key is set', async () => {
    const spy = vi.spyOn(firestoreModule, 'getFirestoreDocument').mockResolvedValue(null);
    const last4 = await getGeminiKeyLast4(sa, 'uid-1');
    expect(last4).toBeNull();
    spy.mockRestore();
  });
});
