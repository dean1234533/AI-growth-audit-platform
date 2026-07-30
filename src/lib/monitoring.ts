import { addDoc, collection, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebaseClient';
import { runAudit } from './api';
import type { AuditResult, ScanFrequency } from './types';

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

/** Runs the first audit for a new website and creates both the website doc and its first scan. */
export async function addWebsiteWithFirstScan(
  uid: string,
  url: string,
  frequency: ScanFrequency,
): Promise<{ websiteId: string; audit: AuditResult }> {
  const audit = await runAudit(url);
  const now = new Date();
  const nextScanDue = computeNextScanDue(frequency, now);

  const websiteRef = await addDoc(collection(db, 'websites'), {
    uid,
    url: audit.url,
    name: deriveName(audit.url),
    frequency,
    status: 'active',
    createdAt: serverTimestamp(),
    lastScannedAt: serverTimestamp(),
    nextScanDue: nextScanDue ? Timestamp.fromDate(nextScanDue) : null,
    latestOverallScore: audit.overallScore,
    latestCategoryScores: audit.categories.map((c) => ({ id: c.id, score: c.score })),
  });

  await addDoc(collection(db, 'websites', websiteRef.id, 'scans'), audit);

  return { websiteId: websiteRef.id, audit };
}

/** Runs a fresh audit for an existing monitored website and appends it to scan history. */
export async function runManualScan(websiteId: string, url: string, frequency: ScanFrequency): Promise<AuditResult> {
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
