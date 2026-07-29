/**
 * Minimal Firestore REST client using a Google service account, for use inside
 * Cloudflare Pages Functions (no Node.js firebase-admin SDK available in Workers runtime).
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey('pkcs8', bytes.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Failed to obtain Firestore access token: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

type FirestoreValue = { stringValue: string } | { integerValue: string } | { booleanValue: boolean } | { timestampValue: string } | { mapValue: { fields: Record<string, FirestoreValue> } };

function toFirestoreValue(value: unknown): FirestoreValue {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { integerValue: String(Math.trunc(value)) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value && typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export async function addFirestoreDocument(
  serviceAccount: ServiceAccount,
  collection: string,
  data: Record<string, unknown>,
): Promise<void> {
  const token = await getAccessToken(serviceAccount);
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${collection}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore write failed: ${res.status} ${text}`);
  }
}

export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
}
