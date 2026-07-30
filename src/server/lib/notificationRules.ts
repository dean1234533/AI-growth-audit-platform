import type { AuditResult } from '../../lib/types';
import type { NotificationType } from '../../lib/notifications';

export interface CategoryScoreSnapshot {
  id: string;
  score: number;
}

export interface ScanSnapshot {
  overallScore: number;
  categoryScores: CategoryScoreSnapshot[];
}

export interface DraftNotification {
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  websiteId: string;
  websiteName: string;
}

const HEALTH_DELTA_THRESHOLD = 5;
const CRITICAL_CATEGORY_THRESHOLD = 50;
const PERFORMANCE_DROP_THRESHOLD = 10;

function categoryScore(snapshot: ScanSnapshot | null, id: string): number | null {
  return snapshot?.categoryScores.find((c) => c.id === id)?.score ?? null;
}

function categoryLabel(audit: AuditResult, id: string): string {
  return audit.categories.find((c) => c.id === id)?.label ?? id;
}

/**
 * Turns a fresh scan (plus the website's previous denormalized score snapshot, if any) into
 * the set of Notification Centre entries it should produce. Pure and side-effect free so it
 * can be unit-reasoned-about independently of Firestore/push delivery.
 */
export function buildScanNotifications(
  audit: AuditResult,
  previous: ScanSnapshot | null,
  website: { id: string; name: string; frequency: 'daily' | 'weekly' | 'monthly' | 'manual' },
): DraftNotification[] {
  const notifications: DraftNotification[] = [];
  const detailUrl = `/dashboard/${website.id}`;
  const scoreDelta = previous ? audit.overallScore - previous.overallScore : 0;

  const base = { websiteId: website.id, websiteName: website.name };

  if (previous && scoreDelta <= -HEALTH_DELTA_THRESHOLD) {
    notifications.push({
      ...base,
      type: 'health_declined',
      title: `${website.name} health dropped`,
      body: `Overall score fell from ${previous.overallScore} to ${audit.overallScore}. Check what changed.`,
      url: detailUrl,
    });
  } else if (previous && scoreDelta >= HEALTH_DELTA_THRESHOLD) {
    notifications.push({
      ...base,
      type: 'health_improved',
      title: `${website.name} health improved`,
      body: `Overall score climbed from ${previous.overallScore} to ${audit.overallScore}. Nice work.`,
      url: detailUrl,
    });
  }

  for (const category of audit.categories) {
    const prevScore = categoryScore(previous, category.id);
    const tippedCritical = category.score < CRITICAL_CATEGORY_THRESHOLD && (prevScore === null || prevScore >= CRITICAL_CATEGORY_THRESHOLD);
    if (tippedCritical) {
      const isSecurity = category.id === 'trust';
      notifications.push({
        ...base,
        type: isSecurity ? 'security_warning' : 'critical_alert',
        title: isSecurity ? `Security issue on ${website.name}` : `Critical issue on ${website.name}`,
        body: `${categoryLabel(audit, category.id)} dropped to ${category.score}/100 — this needs attention.`,
        url: detailUrl,
      });
    }
  }

  const perfPrev = categoryScore(previous, 'performance');
  const perfNow = audit.categories.find((c) => c.id === 'performance')?.score ?? null;
  if (perfPrev !== null && perfNow !== null && perfPrev - perfNow >= PERFORMANCE_DROP_THRESHOLD) {
    notifications.push({
      ...base,
      type: 'performance_drop',
      title: `${website.name} got slower`,
      body: `Performance score dropped ${perfPrev - perfNow} points, from ${perfPrev} to ${perfNow}.`,
      url: detailUrl,
    });
  }

  if (website.frequency === 'weekly') {
    notifications.push({
      ...base,
      type: 'weekly_report',
      title: `${website.name} weekly report is ready`,
      body: `Your latest weekly health report is in — overall score ${audit.overallScore}/100.`,
      url: `${detailUrl}#reports`,
    });
  }

  const hasUrgentNotification = notifications.some((n) => n.type !== 'weekly_report');
  if (!hasUrgentNotification) {
    const topRecommendation = [...audit.recommendations].sort((a, b) => {
      const impactRank: Record<string, number> = { high: 2, medium: 1, low: 0 };
      return (impactRank[b.impact] ?? 0) - (impactRank[a.impact] ?? 0);
    })[0];
    if (topRecommendation) {
      notifications.push({
        ...base,
        type: 'content_recommendation',
        title: `New opportunity for ${website.name}`,
        body: topRecommendation.title,
        url: detailUrl,
      });
    }
  }

  return notifications;
}

export function buildCompetitorActivityNotification(
  competitorName: string,
  competitorScore: number,
  previousScore: number,
  website: { id: string; name: string },
): DraftNotification | null {
  const delta = competitorScore - previousScore;
  if (Math.abs(delta) < HEALTH_DELTA_THRESHOLD * 2) return null;
  const direction = delta > 0 ? 'improved' : 'dropped';
  return {
    websiteId: website.id,
    websiteName: website.name,
    type: 'competitor_activity',
    title: `${competitorName} ${direction}`,
    body: `A competitor you're tracking against ${website.name} ${direction} by ${Math.abs(delta)} points, now ${competitorScore}/100.`,
    url: `/dashboard/${website.id}#monitoring`,
  };
}
