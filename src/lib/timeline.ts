import { buildWeeklyDigest } from './reports';
import type { AuditResult } from './types';

export type TimelineEntryType = 'scan_completed' | 'issue_detected' | 'issue_fixed' | 'score_improved' | 'score_worsened';

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  date: string;
  title: string;
  detail?: string;
}

const CATEGORY_DELTA_THRESHOLD = 5;

/**
 * The single source of truth for "what changed" — derives a chronological feed purely from
 * scan history already being fetched (no separate collection, no duplicated state). Dashboard
 * shows the most recent slice of this; Monitoring shows the full feed with filters.
 */
export function buildTimeline(scans: AuditResult[]): TimelineEntry[] {
  const sorted = [...scans].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
  const entries: TimelineEntry[] = [];

  sorted.forEach((scan, i) => {
    const previous = i > 0 ? sorted[i - 1] : null;

    entries.push({
      id: `scan-${scan.scannedAt}`,
      type: 'scan_completed',
      date: scan.scannedAt,
      title: 'Scan completed',
      detail: `Overall score ${scan.overallScore}/100`,
    });

    if (!previous) return;

    const digest = buildWeeklyDigest('', '', scan, previous);
    for (const rec of digest.newIssues) {
      entries.push({ id: `new-${scan.scannedAt}-${rec.id}`, type: 'issue_detected', date: scan.scannedAt, title: rec.title, detail: rec.description });
    }
    for (const rec of digest.resolvedIssues) {
      entries.push({ id: `fixed-${scan.scannedAt}-${rec.id}`, type: 'issue_fixed', date: scan.scannedAt, title: rec.title });
    }

    for (const category of scan.categories) {
      const prevCategory = previous.categories.find((c) => c.id === category.id);
      if (!prevCategory) continue;
      const delta = category.score - prevCategory.score;
      if (delta >= CATEGORY_DELTA_THRESHOLD) {
        entries.push({
          id: `improve-${scan.scannedAt}-${category.id}`,
          type: 'score_improved',
          date: scan.scannedAt,
          title: `${category.label} improved`,
          detail: `${prevCategory.score} → ${category.score}`,
        });
      } else if (delta <= -CATEGORY_DELTA_THRESHOLD) {
        entries.push({
          id: `worsen-${scan.scannedAt}-${category.id}`,
          type: 'score_worsened',
          date: scan.scannedAt,
          title: `${category.label} declined`,
          detail: `${prevCategory.score} → ${category.score}`,
        });
      }
    }
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
