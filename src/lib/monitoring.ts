import { addDoc, collection, doc, getDoc, getDocs, limit, query, updateDoc, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import { runAudit, createWebsite } from './api';
import type { AuditResult, ScanFrequency } from './types';

/** Fire-and-forget admin alert for events that only happen client-side. */
function notifyAdmin(event: 'new_website', fields: Record<string, string>): void {
  fetch('/api/admin-notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, email: auth.currentUser?.email ?? '', ...fields }),
  }).catch(() => {});
}

interface NotifyScanPayload {
  uid: string;
  websiteId: string;
  websiteName: string;
  frequency: ScanFrequency;
  audit: AuditResult;
  previous: { overallScore: number; categoryScores: { id: string; score: number }[] } | null;
}

/** Fire-and-forget: asks the server to diff this scan against the previous one and deliver
 * Notification Centre entries + push alerts. Never blocks or fails the scan itself. */
function notifyScan(payload: NotifyScanPayload): void {
  fetch('/api/notify-scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function computeNextScanDue(frequency: ScanFrequency, from: Date): Date | null {
  if (frequency === 'manual') return null;
  const next = new Date(from);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

function deriveName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface ExistingWebsiteMatch {
  id: string;
  name: string;
  latestOverallScore?: number;
  latestCategoryScores?: { id: string; score: number }[];
}

/** Finds a website this user is already monitoring at the given (normalized) URL, if any. */
async function findExistingWebsite(uid: string, normalizedUrl: string): Promise<ExistingWebsiteMatch | null> {
  const snap = await getDocs(query(collection(db, 'websites'), where('uid', '==', uid), where('url', '==', normalizedUrl), limit(1)));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Omit<ExistingWebsiteMatch, 'id'>) };
}

/**
 * Runs the first audit for a new website and creates both the website doc and its first scan —
 * or, if this user is already monitoring that exact URL, records this as a fresh scan on the
 * existing website instead of creating a duplicate entry.
 */
export async function addWebsiteWithFirstScan(
  uid: string,
  url: string,
  frequency: ScanFrequency,
): Promise<{ websiteId: string; audit: AuditResult }> {
  const audit = await runAudit(url);
  const now = new Date();
  const nextScanDue = computeNextScanDue(frequency, now);

  const existing = await findExistingWebsite(uid, audit.url);
  if (existing) {
    await addDoc(collection(db, 'websites', existing.id, 'scans'), audit);
    await updateDoc(doc(db, 'websites', existing.id), {
      lastScannedAt: serverTimestamp(),
      nextScanDue: nextScanDue ? Timestamp.fromDate(nextScanDue) : null,
      latestOverallScore: audit.overallScore,
      latestCategoryScores: audit.categories.map((c) => ({ id: c.id, score: c.score })),
    });

    notifyScan({
      uid,
      websiteId: existing.id,
      websiteName: existing.name,
      frequency,
      audit,
      previous:
        existing.latestOverallScore === undefined
          ? null
          : { overallScore: existing.latestOverallScore, categoryScores: existing.latestCategoryScores ?? [] },
    });

    return { websiteId: existing.id, audit };
  }

  // Creation (unlike the rescan-existing-website branch above) is subject to the plan-based
  // website limit, enforced server-side — see src/pages/api/websites.ts and
  // src/server/lib/access.ts. firestore.rules denies a direct client write here, so this is
  // the only way a new website doc can come into existence.
  const { websiteId } = await createWebsite(audit.url, deriveName(audit.url), frequency, audit);

  notifyScan({
    uid,
    websiteId,
    websiteName: deriveName(audit.url),
    frequency,
    audit,
    previous: null,
  });

  notifyAdmin('new_website', { websiteUrl: audit.url, websiteName: deriveName(audit.url), frequency });

  return { websiteId, audit };
}

/** Runs a fresh audit for an existing monitored website and appends it to scan history. */
export async function runManualScan(websiteId: string, url: string, frequency: ScanFrequency): Promise<AuditResult> {
  const websiteSnap = await getDoc(doc(db, 'websites', websiteId));
  const websiteData = websiteSnap.data() as
    | { uid: string; name: string; latestOverallScore?: number; latestCategoryScores?: { id: string; score: number }[] }
    | undefined;

  const audit = await runAudit(url);
  const now = new Date();
  const nextScanDue = computeNextScanDue(frequency, now);

  await addDoc(collection(db, 'websites', websiteId, 'scans'), audit);
  await updateDoc(doc(db, 'websites', websiteId), {
    lastScannedAt: serverTimestamp(),
    nextScanDue: nextScanDue ? Timestamp.fromDate(nextScanDue) : null,
    latestOverallScore: audit.overallScore,
    latestCategoryScores: audit.categories.map((c) => ({ id: c.id, score: c.score })),
  });

  if (websiteData) {
    notifyScan({
      uid: websiteData.uid,
      websiteId,
      websiteName: websiteData.name,
      frequency,
      audit,
      previous:
        websiteData.latestOverallScore === undefined
          ? null
          : { overallScore: websiteData.latestOverallScore, categoryScores: websiteData.latestCategoryScores ?? [] },
    });
  }

  return audit;
}

// Competitors default to a weekly re-scan cadence — there's no per-competitor frequency
// picker (that would be a lot of UI for a secondary feature); weekly is a sane default that
// keeps the comparison reasonably current without burning through the free Workers AI quota.
const COMPETITOR_FREQUENCY: ScanFrequency = 'weekly';

/** Runs the first audit for a competitor URL and adds it under the primary website. */
export async function addCompetitorWithFirstScan(
  websiteId: string,
  url: string,
): Promise<{ competitorId: string; audit: AuditResult }> {
  const audit = await runAudit(url);
  const now = new Date();
  const nextScanDue = computeNextScanDue(COMPETITOR_FREQUENCY, now);

  const competitorRef = await addDoc(collection(db, 'websites', websiteId, 'competitors'), {
    url: audit.url,
    name: deriveName(audit.url),
    addedAt: serverTimestamp(),
    lastScannedAt: serverTimestamp(),
    nextScanDue: nextScanDue ? Timestamp.fromDate(nextScanDue) : null,
    latestOverallScore: audit.overallScore,
    latestCategoryScores: audit.categories.map((c) => ({ id: c.id, score: c.score })),
  });

  await addDoc(collection(db, 'websites', websiteId, 'competitors', competitorRef.id, 'scans'), audit);

  return { competitorId: competitorRef.id, audit };
}
