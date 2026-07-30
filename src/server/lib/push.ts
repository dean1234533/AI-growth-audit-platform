// Web Push (RFC 8030 delivery, RFC 8291 aes128gcm payload encryption, RFC 8292 VAPID auth).
// Cloudflare Workers can't use the Node-based `web-push` npm package, so this hand-implements
// the encryption/signing using the Web Crypto API — the same pattern already used for
// service-account JWT signing in firestore.ts, but with ES256/ECDH instead of RS256.

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface VapidJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  d: string;
  key_ops?: string[];
  ext?: boolean;
}

const VAPID_SUBJECT = 'mailto:dean@dean-da-dev.co.uk';

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Web Crypto's TS types want a plain ArrayBuffer, not a possibly-offset Uint8Array view. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, toArrayBuffer(data));
  return new Uint8Array(sig);
}

/** HKDF-Expand for output lengths <= 32 bytes (single-block case, sufficient for our fixed-size keys). */
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const full = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return full.slice(0, length);
}

async function signVapidJwt(privateJwk: VapidJwk, audience: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { ...privateJwk, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  };

  const encoder = new TextEncoder();
  const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const claimsB64 = bytesToBase64Url(encoder.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(signature)}`;
}

/** Encrypts a JSON payload per RFC 8291 (aes128gcm content-coding, single record). */
async function encryptPayload(payload: unknown, subscription: PushSubscriptionJSON): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlToBytes(subscription.keys.p256dh);
  const authSecret = base64UrlToBytes(subscription.keys.auth);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  const uaPublicKey = await crypto.subtle.importKey('raw', toArrayBuffer(uaPublicBytes), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicBytes = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

  const sharedSecretBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, localKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const encoder = new TextEncoder();
  const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), uaPublicBytes, localPublicBytes);
  const prkCombine = await hmacSha256(authSecret, sharedSecret);
  const ikm = await hkdfExpand(prkCombine, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);

  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);

  const cekKey = await crypto.subtle.importKey('raw', toArrayBuffer(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  const recordPlaintext = concatBytes(plaintext, new Uint8Array([2])); // 0x02 = last (only) record delimiter
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce) }, cekKey, toArrayBuffer(recordPlaintext)),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, rs, new Uint8Array([localPublicBytes.length]), localPublicBytes);

  return concatBytes(header, ciphertext);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

export interface PushSendResult {
  ok: boolean;
  /** true when the push service reports the subscription no longer exists — caller should delete it. */
  expired: boolean;
  status?: number;
}

export async function sendPushNotification(
  subscription: PushSubscriptionJSON,
  payload: PushNotificationPayload,
  vapidPrivateKeyJwkJson: string,
  vapidPublicKey: string,
): Promise<PushSendResult> {
  const privateJwk = JSON.parse(vapidPrivateKeyJwkJson) as VapidJwk;
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const [jwt, body] = await Promise.all([signVapidJwt(privateJwk, audience), encryptPayload(payload, subscription)]);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: toArrayBuffer(body),
  });

  if (response.status === 404 || response.status === 410) {
    return { ok: false, expired: true, status: response.status };
  }

  return { ok: response.ok, expired: false, status: response.status };
}
