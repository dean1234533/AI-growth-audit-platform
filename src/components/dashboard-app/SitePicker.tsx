import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Sparkles, ArrowRight, Globe } from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';

interface WebsiteDoc {
  id: string;
  name: string;
  url: string;
}

interface SitePickerProps {
  anchor: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyBody: string;
}

export default function SitePicker({ anchor, eyebrow, title, subtitle, emptyTitle, emptyBody }: SitePickerProps) {
  const user = useAuthUser();
  const [websites, setWebsites] = useState<WebsiteDoc[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'websites'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const sites = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WebsiteDoc, 'id'>) }));
      setWebsites(sites);
      if (sites.length === 1) {
        window.location.href = `/dashboard/${sites[0].id}#${anchor}`;
      }
    });
    return unsubscribe;
  }, [user, anchor]);

  if (!user || websites === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading…</div>
      </div>
    );
  }

  if (websites.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <GlassCard className="flex flex-col items-center gap-4 p-16">
          <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
            <Sparkles className="size-6" />
          </span>
          <h1 className="font-display text-xl font-bold text-ink dark:text-white">{emptyTitle}</h1>
          <p className="text-sm text-slate">{emptyBody}</p>
          <Button onClick={() => (window.location.href = '/dashboard')}>Go to Dashboard</Button>
        </GlassCard>
      </div>
    );
  }

  if (websites.length === 1) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Redirecting…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{eyebrow}</span>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate">{subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {websites.map((site) => (
          <a
            key={site.id}
            href={`/dashboard/${site.id}#${anchor}`}
            className="glass gradient-border gradient-border-brand group flex items-center justify-between gap-3 rounded-[20px] px-6 py-5 transition-transform hover:-translate-y-1"
          >
            <span className="inline-flex items-center gap-2 font-semibold text-ink dark:text-white">
              <Globe className="size-4 text-brand-500" />
              {site.name}
            </span>
            <ArrowRight className="size-4 text-brand-500 transition-transform group-hover:translate-x-1" />
          </a>
        ))}
      </div>
    </div>
  );
}
