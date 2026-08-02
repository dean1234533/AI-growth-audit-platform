import type { AuditPriority } from './scanBudget';
import { verifyFirebaseIdToken } from './verifyFirebaseIdToken';
import { ADMIN_EMAIL } from './access';

export type { AuditPriority };

/**
 * Resolves Browser Rendering priority for an HTTP request — SERVER-SIDE, from a verified
 * Firebase ID token only. Never reads a client-supplied priority/purpose field; there is no
 * such field anywhere in the request handling for exactly this reason (a client claiming
 * `{"priority":"admin"}` must have no effect whatsoever).
 *
 * - A verified token whose email matches ADMIN_EMAIL -> 'admin' (same identity check already
 *   used for admin plan resolution in access.ts — not duplicated logic, just applied here too).
 * - Any other verified token -> 'customer'. Deliberately covers BOTH an existing website's
 *   manual "Scan Now" and a new website's initial audit identically — both are real,
 *   authenticated customer actions and get the same protected-reservation treatment; there's no
 *   need to distinguish them further for budget purposes.
 * - No token, or a token that fails verification (expired, malformed, wrong project) -> 'public'.
 *
 * 'monitoring' is deliberately never resolved by this function — it only ever comes from cron's
 * own server-only code path (runDueScans.ts has no HTTP entry point, so there is nothing for a
 * request to spoof).
 */
export async function resolveHttpAuditPriority(request: Request, projectId: string | undefined): Promise<AuditPriority> {
  if (!projectId) return 'public';
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return 'public';
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  if (!verified?.uid) return 'public';
  return verified.email === ADMIN_EMAIL ? 'admin' : 'customer';
}
