import type { AuditResult, Lead, EnquiryLead } from './types';

export class ApiError extends Error {}

interface ErrorResponse {
  error?: string;
}

async function parseErrorResponse(res: Response): Promise<ErrorResponse> {
  return (await res.json().catch(() => ({}))) as ErrorResponse;
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
