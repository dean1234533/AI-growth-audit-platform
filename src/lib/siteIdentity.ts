import type { AuditResult } from './types';

const GENERIC_TITLES = new Set(['home', 'homepage', 'welcome', 'login', 'log in', 'sign in', 'dashboard', 'app']);
const KNOWN_ACRONYMS = new Set(['ai', 'db', 'seo', 'ui', 'ux']);

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

function humaniseHost(url: string): string {
  const root = hostname(url).split('.')[0] || hostname(url);
  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => KNOWN_ACRONYMS.has(part.toLowerCase()) ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function titleCandidate(pageTitle?: string | null): string | null {
  if (!pageTitle?.trim()) return null;
  const decoded = pageTitle
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  const candidates = decoded.split(/\s+(?:[|–—·]|-)\s+/).map((part) => part.trim()).filter(Boolean);
  return candidates.find((candidate) => !GENERIC_TITLES.has(candidate.toLowerCase()) && !candidate.includes('://')) ?? null;
}

export function deriveSiteName(audit: { url: string; meta: Pick<AuditResult['meta'], 'businessName' | 'pageTitle'> }): string {
  return audit.meta.businessName?.trim() || titleCandidate(audit.meta.pageTitle) || humaniseHost(audit.url);
}

export function monitoredSiteName(site: { url: string; name?: string; businessName?: string }): string {
  if (site.businessName?.trim()) return site.businessName.trim();
  const stored = site.name?.trim();
  const host = hostname(site.url);
  if (stored && stored.toLowerCase().replace(/^www\./, '') !== host.toLowerCase() && !stored.includes('://')) return stored;
  return humaniseHost(site.url);
}

export function siteKind(siteType?: 'website' | 'app', url?: string): 'Website' | 'App' {
  if (siteType === 'app') return 'App';
  if (siteType === 'website') return 'Website';
  return hostname(url ?? '').toLowerCase().startsWith('app.') ? 'App' : 'Website';
}
