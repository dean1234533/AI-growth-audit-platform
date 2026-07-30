import type { AuditResult, Recommendation } from './types';

export interface WeeklyDigest {
  siteName: string;
  siteUrl: string;
  currentScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  scannedAt: string;
  resolvedIssues: Recommendation[];
  newIssues: Recommendation[];
  topPriority: Recommendation | null;
}

/** Compares the two most recent scans to produce a real, data-backed "what changed" summary. */
export function buildWeeklyDigest(siteName: string, siteUrl: string, current: AuditResult, previous: AuditResult | null): WeeklyDigest {
  const previousIds = new Set((previous?.recommendations ?? []).map((r) => r.id));
  const currentIds = new Set(current.recommendations.map((r) => r.id));

  const newIssues = current.recommendations.filter((r) => !previousIds.has(r.id));
  const resolvedIssues = (previous?.recommendations ?? []).filter((r) => !currentIds.has(r.id));

  return {
    siteName,
    siteUrl,
    currentScore: current.overallScore,
    previousScore: previous?.overallScore ?? null,
    scoreDelta: previous ? current.overallScore - previous.overallScore : null,
    scannedAt: current.scannedAt,
    resolvedIssues,
    newIssues,
    topPriority: current.recommendations[0] ?? null,
  };
}
