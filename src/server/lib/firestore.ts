/**
 * Minimal Firestore REST client using a Google service account, for use inside
 * Cloudflare Workers (no Node.js firebase-admin SDK available in the Workers runtime).
 */

export interface ServiceAccount {
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

type FirestoreValue =
  | { nullValue: null }
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) obj[k] = fromFirestoreValue(v);
    return obj;
  }
  return null;
}

function docNameToId(name: string): string {
  return name.split('/').pop() ?? name;
}

function fieldsToDoc(name: string, fields: Record<string, FirestoreValue>): Record<string, unknown> {
  // `documents/websites/{websiteId}/competitors/{competitorId}` -> ['websites', websiteId, 'competitors', competitorId]
  const pathParts = name.split('/documents/')[1]?.split('/') ?? [];
  const obj: Record<string, unknown> = { id: docNameToId(name), path: pathParts };
  for (const [k, v] of Object.entries(fields)) obj[k] = fromFirestoreValue(v);
  return obj;
}

export async function addFirestoreDocument(
  serviceAccount: ServiceAccount,
  collection: string,
  data: Record<string, unknown>,
): Promise<string> {
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
  const json = (await res.json()) as { name: string };
  return docNameToId(json.name);
}

/**
 * Updates specific fields on an existing document (partial update via updateMask —
 * fields not listed are left untouched).
 */
export async function updateFirestoreDocument(
  serviceAccount: ServiceAccount,
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const token = await getAccessToken(serviceAccount);
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);

  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${collectionPath}/${docId}?${mask}`,
    {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore update failed: ${res.status} ${text}`);
  }
}

/** Fetches a single document by its collection path + ID. Returns null if it doesn't exist. */
export async function getFirestoreDocument(
  serviceAccount: ServiceAccount,
  collectionPath: string,
  docId: string,
): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken(serviceAccount);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${collectionPath}/${docId}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore get failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { name: string; fields: Record<string, FirestoreValue> };
  return fieldsToDoc(json.name, json.fields);
}

/** Lists every document directly under a collection path (e.g. `users/{uid}/pushSubscriptions`). */
export async function listFirestoreDocuments(
  serviceAccount: ServiceAccount,
  collectionPath: string,
): Promise<Record<string, unknown>[]> {
  const token = await getAccessToken(serviceAccount);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${collectionPath}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore list failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { documents?: { name: string; fields: Record<string, FirestoreValue> }[] };
  return (json.documents ?? []).map((d) => fieldsToDoc(d.name, d.fields));
}

/** Deletes a single document — used to remove push subscriptions the push service reports as expired. */
export async function deleteFirestoreDocument(serviceAccount: ServiceAccount, collectionPath: string, docId: string): Promise<void> {
  const token = await getAccessToken(serviceAccount);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${collectionPath}/${docId}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore delete failed: ${res.status} ${text}`);
  }
}

export interface QueryFilter {
  field: string;
  op: 'EQUAL' | 'LESS_THAN_OR_EQUAL' | 'LESS_THAN' | 'GREATER_THAN_OR_EQUAL' | 'GREATER_THAN';
  // Note: value's type must match how the field is stored (e.g. a Date for a field written
  // as a Firestore timestamp) — Firestore's structured queries compare by value type, so a
  // string filter against a timestamp-typed field will silently never match.
  value: string | number | boolean | Date;
}

/**
 * Runs a structured query (collection + simple AND-ed field filters) and returns plain
 * document objects, each with an added `path` array (the full resource path segments) so
 * callers can recover parent document IDs — useful for collection-group queries where a
 * result's parent isn't otherwise derivable.
 */
export async function runQuery(
  serviceAccount: ServiceAccount,
  collection: string,
  filters: QueryFilter[],
  options: { allDescendants?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const token = await getAccessToken(serviceAccount);

  const where =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? fieldFilter(filters[0])
        : {
            compositeFilter: {
              op: 'AND',
              filters: filters.map((f) => fieldFilter(f)),
            },
          };

  const body = {
    structuredQuery: {
      from: [{ collectionId: collection, allDescendants: options.allDescendants ?? false }],
      ...(where ? { where } : {}),
    },
  };

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore query failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { document?: { name: string; fields: Record<string, FirestoreValue> } }[];
  return json.filter((row) => row.document).map((row) => fieldsToDoc(row.document!.name, row.document!.fields));
}

function fieldFilter(filter: QueryFilter) {
  return {
    fieldFilter: {
      field: { fieldPath: filter.field },
      op: filter.op,
      value: toFirestoreValue(filter.value),
    },
  };
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
