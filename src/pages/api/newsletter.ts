import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { addFirestoreDocument, parseServiceAccount } from '../../server/lib/firestore';

export const prerender = false;

interface Env {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const cfEnv = env as unknown as Env;

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400);
  }

  const email = (body.email ?? '').trim();
  if (!EMAIL_REGEX.test(email)) {
    return jsonError('Please enter a valid email address', 400);
  }

  const serviceAccount = parseServiceAccount(cfEnv.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!serviceAccount) {
    return new Response(JSON.stringify({ ok: true, stored: false }), { headers: { 'content-type': 'application/json' } });
  }

  try {
    await addFirestoreDocument(serviceAccount, 'newsletter', { email, createdAt: new Date() });
  } catch {
    return jsonError('Could not subscribe right now. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true, stored: true }), { headers: { 'content-type': 'application/json' } });
};
