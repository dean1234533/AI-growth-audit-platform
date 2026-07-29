import type { AuditResult, Lead } from './types';

export class ApiError extends Error {}

export async function runAudit(url: string): Promise<AuditResult> {
  const res = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json.error ?? 'Something went wrong analysing this website. Please try again.');
  }
  return json as AuditResult;
}

export async function submitLead(lead: Lead, audit: Pick<AuditResult, 'url' | 'overallScore' | 'scannedAt'>): Promise<void> {
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...lead, audit }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json.error ?? 'Could not save your details. Please try again.');
  }
}
