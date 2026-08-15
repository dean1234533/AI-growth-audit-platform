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

/**
 * Built by the 15-minute lightweight uptime cron pass (cron/runLightweightChecks.ts), not the
 * full-scan pipeline — a site going down/recovering is worth telling a Pro user about
 * immediately, rather than waiting for the next scheduled full audit.
 */
export function buildUptimeNotification(status: 'down' | 'recovered', website: { id: string; name: string }): DraftNotification {
  const base = { websiteId: website.id, websiteName: website.name };
  const detailUrl = `/dashboard/${website.id}`;
  if (status === 'down') {
    return {
      ...base,
      type: 'site_down',
      title: `${website.name} is down`,
      body: `${website.name} did not respond to two checks in a row — it may be offline right now.`,
      url: detailUrl,
    };
  }
  return {
    ...base,
    type: 'site_recovered',
    title: `${website.name} is back up`,
    body: `${website.name} is responding again.`,
    url: detailUrl,
  };
}

/**
 * Built when the 15-minute lightweight check's content-drift comparison (in
 * cron/runLightweightChecks.ts) finds the homepage still responding (not "down") but its
 * content has collapsed relative to its own last known-good snapshot — a hacked/defaced page, a
 * crashed plugin blanking the site, or a bad deploy all return 200 OK and would otherwise look
 * perfectly healthy to a plain uptime check.
 */
export function buildContentIssueNotification(status: 'issue' | 'recovered', website: { id: string; name: string }): DraftNotification {
  const base = { websiteId: website.id, websiteName: website.name };
  const detailUrl = `/dashboard/${website.id}`;
  if (status === 'issue') {
    return {
      ...base,
      type: 'content_issue',
      title: `${website.name} looks broken`,
      body: `${website.name} is responding, but its homepage content changed dramatically — this could be a hack, a crashed plugin, or a bad deploy. Worth checking.`,
      url: detailUrl,
    };
  }
  return {
    ...base,
    type: 'content_recovered',
    title: `${website.name} looks normal again`,
    body: `${website.name}'s homepage content is back to looking like itself.`,
    url: detailUrl,
  };
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
