import type { AuditResult, Lead, EnquiryLead, ScanFrequency } from './types';
import { auth } from './firebaseClient';

export class ApiError extends Error {}

interface ErrorResponse {
  error?: string;
  message?: string;
}

async function parseErrorResponse(res: Response): Promise<ErrorResponse> {
  return (await res.json().catch(() => ({}))) as ErrorResponse;
}

async function authHeaders(): Promise<Record<string, string>> {
  const idToken = await auth.currentUser?.getIdToken();
  return idToken ? { authorization: `Bearer ${idToken}` } : {};
}

/** Mirrors src/server/lib/access.ts's WebsiteQuota — kept as a response shape only, never
 * duplicating the actual limit numbers, which live solely on the server. */
export interface WebsiteQuota {
  planId: 'free' | 'pro' | 'admin';
  currentCount: number;
  maxWebsites: number | null;
  unlimited: boolean;
  canAdd: boolean;
  limitMessage: string | null;
}

export async function getWebsiteQuota(): Promise<WebsiteQuota> {
  const res = await fetch('/api/websites', { headers: await authHeaders() });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.message ?? json.error ?? 'Could not load your website usage.');
  }
  return (await res.json()) as WebsiteQuota;
}

export interface CreateWebsiteResult {
  websiteId: string;
  audit: AuditResult;
}

/** Creates a new monitored website + its first scan. The plan-based website limit is enforced
 * entirely server-side (src/pages/api/websites.ts) — this is the only path that can create a
 * website doc; direct Firestore writes are denied by firestore.rules. */
export async function createWebsite(url: string, name: string | undefined, frequency: ScanFrequency, audit: AuditResult): Promise<CreateWebsiteResult> {
  const res = await fetch('/api/websites', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ url, name, frequency, audit }),
  });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.message ?? json.error ?? 'Could not add this website. Please try again.');
  }
  return (await res.json()) as CreateWebsiteResult;
}

export interface AuditIntakeContext {
  businessName?: string;
  businessType?: string;
  location?: string;
}

export async function runAudit(url: string, context?: AuditIntakeContext): Promise<AuditResult> {
  const res = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, ...context }),
  });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.error ?? 'Something went wrong analysing this website. Please try again.');
  }
  return (await res.json()) as AuditResult;
}

export async function submitLead(lead: Lead, audit: Pick<AuditResult, 'url' | 'overallScore' | 'scannedAt'>): Promise<void> {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...lead, audit, source: 'pdf_download' }),
  });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.error ?? 'Could not save your details. Please try again.');
  }
}

export async function submitEnquiry(
  lead: EnquiryLead,
  audit: Pick<AuditResult, 'url' | 'overallScore' | 'scannedAt' | 'categories' | 'recommendations'>,
  recommendedServices: string[],
): Promise<void> {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...lead, audit, source: 'enquiry', recommendedServices }),
  });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.error ?? 'Could not send your enquiry. Please try again.');
  }
}

export async function subscribeNewsletter(email: string): Promise<void> {
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.error ?? 'Could not subscribe right now. Please try again.');
  }
}
