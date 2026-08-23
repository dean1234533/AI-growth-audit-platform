import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, type Timestamp } from 'firebase/firestore';
import { Plus, LogOut, Globe, Clock } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { ScoreCircle } from '../dashboard/ScoreCircle';
import { scoreBand } from '../../lib/scoreBand';
import { AddWebsiteModal } from './AddWebsiteModal';
import { getUserSettings } from '../../lib/userSettings';
import { getWebsiteQuota, type WebsiteQuota } from '../../lib/api';
import { deriveSiteName, monitoredSiteName, siteKind } from '../../lib/siteIdentity';
import type { AuditResult, CategoryId, ScanFrequency } from '../../lib/types';

interface WebsiteDoc {
  id: string;
  url: string;
  name: string;
  businessName?: string;
  siteType?: 'website' | 'app';
  frequency: string;
  status: string;
  lastScannedAt: Timestamp | null;
  latestOverallScore: number | null;
  latestCategoryScores: { id: CategoryId; score: number }[];
}

export default function WebsiteHealthCentre() {
  const user = useAuthUser();
  const [websites, setWebsites] = useState<WebsiteDoc[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultFrequency, setDefaultFrequency] = useState<ScanFrequency>('weekly');
  const [quota, setQuota] = useState<WebsiteQuota | null>(null);

  // Refetched after the modal closes too, so the count/limit banner stays accurate right after
  // adding a website — the server (src/pages/api/websites.ts) is the only source of truth for
  // these numbers; nothing here hardcodes 1 / 5 / unlimited.
  useEffect(() => {
    if (!user || modalOpen) return;
    getWebsiteQuota()
      .then(setQuota)
      .catch(() => setQuota(null));
  }, [user, modalOpen]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const q = query(collection(db, 'websites'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const stored = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WebsiteDoc);
      void Promise.all(stored.map(async (site) => {
        if (site.siteType && site.businessName) return site;
        try {
          const latestQuery = query(collection(db, 'websites', site.id, 'scans'), orderBy('scannedAt', 'desc'), limit(1));
          const latestSnap = await getDocs(latestQuery);
          const latest = latestSnap.docs[0]?.data() as AuditResult | undefined;
          if (!latest) return site;
          return {
            ...site,
            siteType: site.siteType ?? latest.meta.siteType,
            businessName: site.businessName?.trim() || latest.meta.businessName?.trim() || deriveSiteName(latest),
          };
        } catch {
          return site;
        }
      })).then((enriched) => {
        if (active) setWebsites(enriched);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('url')) setModalOpen(true);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.uid).then((s) => setDefaultFrequency(s.defaultScanFrequency));
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading your dashboard…</div>
      </div>
    );
  }

  const initialUrl = new URLSearchParams(window.location.search).get('url') ?? undefined;
  const scoredWebsites = websites?.filter((site) => site.latestOverallScore !== null) ?? [];
  const averageScore = scoredWebsites.length
    ? Math.round(scoredWebsites.reduce((total, site) => total + (site.latestOverallScore ?? 0), 0) / scoredWebsites.length)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-ink/10 pb-7 dark:border-white/10">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">Overview</span>
          <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl dark:text-white">
            Your inspected sites
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate">What changed, what needs work, and what to inspect next.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setModalOpen(true)} icon={<Plus className="size-4" />}>
            Add Site
          </Button>
          <Button variant="ghost" icon={<LogOut className="size-4" />} onClick={() => signOut(auth)}>
            Sign Out
          </Button>
        </div>
      </div>

      {websites && websites.length > 0 && (
        <div className="surface mb-10 grid overflow-hidden rounded-2xl sm:grid-cols-3">
          <RegisterMetric label="Portfolio" value={`${websites.length} ${websites.length === 1 ? 'site' : 'sites'}`} note={quota?.unlimited ? 'Unlimited allowance' : quota && quota.maxWebsites !== null ? `${quota.maxWebsites - quota.currentCount} spaces remaining` : 'Allowance loading'} />
          <RegisterMetric label="Average health" value={averageScore === null ? 'Pending' : `${averageScore}/100`} note={averageScore === null ? 'First inspection in progress' : 'Across scored websites'} />
          <RegisterMetric label="Inspection cycle" value="Automatic" note="Changes are logged for review" />
        </div>
      )}

      {quota && !quota.canAdd && (
        <div className="glass mb-10 flex items-start gap-3 rounded-2xl px-5 py-4 text-sm text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300">
          <span>
            <strong className="font-semibold">Website limit reached.</strong> {quota.limitMessage}
          </span>
        </div>
      )}

      {websites === null && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-48 animate-pulse rounded-[24px]" />
          ))}
        </div>
      )}

      {websites?.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-4 p-16 text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Globe className="size-6" />
          </span>
          <h2 className="font-display text-xl font-bold text-ink dark:text-white">No sites monitored yet</h2>
          <p className="max-w-sm text-sm text-slate">
            Add your first website or app and we'll run a full audit immediately, then keep scanning it automatically.
          </p>
          <Button onClick={() => setModalOpen(true)} icon={<Plus className="size-4" />}>
            Add Your First Site
          </Button>
        </GlassCard>
      )}

      {websites && websites.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {websites.map((site, i) => {
            const band = site.latestOverallScore !== null ? scoreBand(site.latestOverallScore) : null;
            const displayName = monitoredSiteName(site);
            return (
              <motion.a
                key={site.id}
                href={`/dashboard/${site.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <article className="group flex h-full flex-col rounded-2xl border border-ink/10 bg-white/75 p-5 shadow-[0_18px_45px_-32px_rgba(17,24,39,0.4)] transition hover:-translate-y-1 hover:border-brand-400/40 hover:shadow-[0_26px_55px_-30px_rgba(59,130,246,0.45)] dark:border-white/10 dark:bg-[#16162a]/80">
                  <div className="mb-5 flex items-center justify-between border-b border-ink/10 pb-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-slate dark:border-white/10">
                    <span>{siteKind(site.siteType, site.url)}</span><span>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-display text-xl font-black tracking-tight text-ink dark:text-white">{displayName}</div>
                      <div className="mt-1 truncate font-mono text-[0.68rem] text-slate">{site.url}</div>
                    </div>
                    {site.latestOverallScore !== null && <ScoreCircle score={site.latestOverallScore} size={64} strokeWidth={5} />}
                  </div>
                  {band && (
                    <span
                      className="inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.06em]"
                      style={{ color: band.color, backgroundColor: `${band.color}18`, borderColor: `${band.color}40` }}
                    >
                      {band.label}
                    </span>
                  )}
                  <div className="mt-auto flex items-center justify-between text-xs font-medium text-slate">
                    <span className="capitalize">{site.frequency} scans</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {site.lastScannedAt ? new Date(site.lastScannedAt.seconds * 1000).toLocaleDateString('en-GB') : 'Pending'}
                    </span>
                  </div>
                </article>
              </motion.a>
            );
          })}
        </div>
      )}

      <AddWebsiteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        uid={user.uid}
        initialUrl={initialUrl}
        defaultFrequency={defaultFrequency}
        onCreated={(websiteId) => {
          setModalOpen(false);
          window.location.href = `/dashboard/${websiteId}`;
        }}
      />
    </div>
  );
}

function RegisterMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-b border-ink/10 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 dark:border-white/10">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate">{label}</span>
      <div className="mt-2 font-display text-2xl font-black tracking-tight text-ink dark:text-white">{value}</div>
      <p className="mt-1 text-xs font-semibold text-slate">{note}</p>
    </div>
  );
}
