/**
 * Verifies a Firebase Auth ID token server-side, in a runtime without the Node
 * firebase-admin SDK (Cloudflare Workers). Mirrors the RS256 JWT handling already done for
 * the outbound service-account JWT in `firestore.ts`, just in reverse (verify instead of sign).
 */

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

function base64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Reads one DER TLV starting at `offset`, returning its tag, content byte range, and the offset right after it. */
function readTlv(buf: Uint8Array, offset: number): { tag: number; start: number; end: number; next: number } {
  const tag = buf[offset];
  let lenByte = buf[offset + 1];
  let lenOffset = offset + 2;
  let length: number;
  if ((lenByte & 0x80) === 0) {
    length = lenByte;
  } else {
    const numBytes = lenByte & 0x7f;
    length = 0;
    for (let i = 0; i < numBytes; i++) length = (length << 8) | buf[lenOffset + i];
    lenOffset += numBytes;
  }
  return { tag, start: lenOffset, end: lenOffset + length, next: lenOffset + length };
}

/** Extracts the SubjectPublicKeyInfo DER bytes from an X.509 certificate — the one substructure Web Crypto's `importKey('spki', ...)` actually accepts. */
function extractSpkiFromCertificate(certDer: Uint8Array): Uint8Array {
  const cert = readTlv(certDer, 0); // Certificate ::= SEQUENCE
  const tbs = readTlv(certDer, cert.start); // TBSCertificate ::= SEQUENCE

  let pos = tbs.start;
  let field = readTlv(certDer, pos);
  if (field.tag === 0xa0) {
    // optional [0] EXPLICIT Version — skip it
    pos = field.next;
    field = readTlv(certDer, pos);
  }
  // serialNumber, signature AlgorithmIdentifier, issuer, validity, subject — skip 5 fields
  for (let i = 0; i < 5; i++) {
    pos = field.next;
    field = readTlv(certDer, pos);
  }
  // `field` is now subjectPublicKeyInfo
  return certDer.slice(pos, field.next);
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && cachedCerts.expiresAt > now) return cachedCerts.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`Failed to fetch Firebase public certs: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = { certs, expiresAt: now + 60 * 60 * 1000 };
  return certs;
}

export interface VerifiedIdToken {
  uid: string;
  email: string | null;
}

/**
 * Verifies a Firebase Auth ID token's signature and standard claims. Returns the verified
 * identity, or null if the token is missing, malformed, expired, or fails verification —
 * callers must treat null as "not authenticated", never assume a default identity.
 */
export async function verifyFirebaseIdToken(idToken: string | null | undefined, projectId: string): Promise<VerifiedIdToken | null> {
  if (!idToken) return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  let header: { kid?: string; alg?: string };
  let payload: { sub?: string; email?: string; aud?: string; iss?: string; exp?: number };
  try {
    header = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[1])));
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) return null;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!payload.sub) return null;

  try {
    const certs = await getCerts();
    const pem = certs[header.kid];
    if (!pem) return null;

    const spki = extractSpkiFromCertificate(pemToDer(pem));
    const key = await crypto.subtle.importKey('spki', spki as BufferSource, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);

    const signature = base64urlToBytes(parts[2]);
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature as BufferSource, signedData);
    if (!valid) return null;
  } catch {
    return null;
  }

  return { uid: payload.sub, email: payload.email ?? null };
}
