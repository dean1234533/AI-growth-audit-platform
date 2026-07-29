import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, type Timestamp } from 'firebase/firestore';
import { Plus, LogOut, Globe, Clock } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { ScoreCircle } from '../dashboard/ScoreCircle';
import { scoreBand } from '../../lib/scoreBand';
import { AddWebsiteModal } from './AddWebsiteModal';
import type { CategoryId } from '../../lib/types';

interface WebsiteDoc {
  id: string;
  url: string;
  name: string;
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

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'websites'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setWebsites(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WebsiteDoc));
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('url')) setModalOpen(true);
  }, [user]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading your dashboard…</div>
      </div>
    );
  }

  const initialUrl = new URLSearchParams(window.location.search).get('url') ?? undefined;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Dashboard</span>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl dark:text-white">
            Website Health Centre
          </h1>
          <p className="mt-1 text-sm text-slate">{user.email}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setModalOpen(true)} icon={<Plus className="size-4" />}>
            Add Website
          </Button>
          <Button variant="ghost" icon={<LogOut className="size-4" />} onClick={() => signOut(auth)}>
            Sign Out
          </Button>
        </div>
      </div>

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
          <h2 className="font-display text-xl font-bold text-ink dark:text-white">No websites monitored yet</h2>
          <p className="max-w-sm text-sm text-slate">
            Add your first website and we'll run a full audit immediately, then keep scanning it automatically.
          </p>
          <Button onClick={() => setModalOpen(true)} icon={<Plus className="size-4" />}>
            Add Your First Website
          </Button>
        </GlassCard>
      )}

      {websites && websites.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {websites.map((site, i) => {
            const band = site.latestOverallScore !== null ? scoreBand(site.latestOverallScore) : null;
            return (
              <motion.a
                key={site.id}
                href={`/dashboard/${site.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <GlassCard gradientBorder className="flex h-full flex-col gap-4 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-display font-bold text-ink dark:text-white">{site.name}</div>
                      <div className="truncate text-xs text-slate">{site.url}</div>
                    </div>
                    {site.latestOverallScore !== null && <ScoreCircle score={site.latestOverallScore} size={64} strokeWidth={5} />}
                  </div>
                  {band && (
                    <span
                      className="inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset"
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
                </GlassCard>
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
        onCreated={(websiteId) => {
          setModalOpen(false);
          window.location.href = `/dashboard/${websiteId}`;
        }}
      />
    </div>
  );
}
