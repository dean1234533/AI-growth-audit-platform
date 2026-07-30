// Minimal Stripe REST client — Stripe's API is plain HTTPS + form-encoding, so no SDK is
// needed (and the official stripe-node package isn't Workers-compatible anyway). Mirrors the
// hand-rolled REST client pattern already used for Firestore and Resend in this codebase.

const STRIPE_API = 'https://api.stripe.com/v1';

function toFormBody(params: Record<string, string | number | string[]>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) parts.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(v)}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

export async function stripeRequest<T = Record<string, unknown>>(
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, string | number | string[]>,
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      authorization: `Basic ${btoa(`${secretKey}:`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params ? toFormBody(params) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`Stripe API error (${path}): ${(json as { error?: { message?: string } }).error?.message ?? res.status}`);
  }
  return json;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a Stripe webhook signature (the `Stripe-Signature` header) against the raw request
 * body, per https://stripe.com/docs/webhooks/signatures — HMAC-SHA256 over `${timestamp}.${payload}`.
 * Must run against the raw, unparsed body (signature won't match re-serialized JSON).
 */
export async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=') as [string, string]));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expectedHex = bytesToHex(signed);

  if (expectedHex.length !== v1.length) return false;
  let mismatch = 0;
  const expectedBytes = hexToBytes(expectedHex);
  const actualBytes = hexToBytes(v1);
  for (let i = 0; i < expectedBytes.length; i++) mismatch |= expectedBytes[i] ^ actualBytes[i];
  return mismatch === 0;
}
