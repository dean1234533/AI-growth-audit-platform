import type { AuditResult, Lead } from './types';

export class ApiError extends Error {}

interface ErrorResponse {
  error?: string;
}

async function parseErrorResponse(res: Response): Promise<ErrorResponse> {
  return (await res.json().catch(() => ({}))) as ErrorResponse;
}

export async function runAudit(url: string): Promise<AuditResult> {
  const res = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
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
    body: JSON.stringify({ ...lead, audit }),
  });
  if (!res.ok) {
    const json = await parseErrorResponse(res);
    throw new ApiError(json.error ?? 'Could not save your details. Please try again.');
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
