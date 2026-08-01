import { verifyFirebaseIdToken } from './verifyFirebaseIdToken';
import { ADMIN_EMAIL } from './adminAlert';

/** Verifies the request's bearer ID token belongs to the admin. Used by every /api/admin/* route. */
export async function requireAdmin(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return false;
  const verified = await verifyFirebaseIdToken(idToken, projectId);
  return verified?.email === ADMIN_EMAIL;
}
