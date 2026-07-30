import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy, deleteDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  MessageCircle,
  LineChart,
  Download,
  CalendarClock,
  Clock,
  CalendarCheck,
  Bell,
  Lightbulb,
} from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { runManualScan } from '../../lib/monitoring';
import { generateAuditPdf } from '../../lib/pdf';
import { CONSULTATION_URL } from '../../lib/seo/site';
import { subscribeToNotifications } from '../../lib/notifications';
import { WebsiteHealthHero } from '../dashboard/WebsiteHealthHero';
import { CategoryCard } from '../dashboard/CategoryCard';
import { RadarScoreChart, SeverityBarChart, PerformanceBreakdownChart } from '../dashboard/Charts';
import { ScoreTrendChart } from './ScoreTrendChart';
import AiCoach from './AiCoach';
import CompetitorsSection from './CompetitorsSection';
import ReportsSection from './ReportsSection';
import ScanHistory from './ScanHistory';
import { Button } from '../ui/Button';
import { GlassCard } from '../ui/GlassCard';
import type { AuditResult, ScanFrequency } from '../../lib/types';

interface WebsiteDoc {
  id: string;
  uid: string;
  url: string;
  name: string;
  frequency: ScanFrequency;
  status: 'active' | 'paused';
  lastScannedAt: Timestamp | null;
  nextScanDue: Timestamp | null;
}

interface WebsiteDetailProps {
  websiteId: string;
}

function formatTimestamp(ts: Timestamp | null): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WebsiteDetail({ websiteId }: WebsiteDetailProps) {
  const user = useAuthUser();
  const [website, setWebsite] = useState<WebsiteDoc | null | undefined>(undefined);
  const [scans, setScans] = useState<(AuditResult & { id: string })[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubWebsite = onSnapshot(
      doc(db, 'websites', websiteId),
      (snap) => {
        if (!snap.exists()) {
          setWebsite(null);
          return;
        }
        setWebsite({ id: snap.id, ...(snap.data() as Omit<WebsiteDoc, 'id'>) });
      },
      () => setWebsite(null),
    );

    const scansQuery = query(collection(db, 'websites', websiteId, 'scans'), orderBy('scannedAt', 'asc'));
    const unsubScans = onSnapshot(scansQuery, (snap) => {
      setScans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditResult) })));
    });

    const unsubNotifications = subscribeToNotifications(user.uid, (notifications) => {
      setUnreadCount(notifications.filter((n) => !n.read && n.websiteId === websiteId).length);
    });

    return () => {
      unsubWebsite();
      unsubScans();
      unsubNotifications();
    };
  }, [user, websiteId]);

  async function handleScanNow() {
    if (!website) return;
    setScanning(true);
    setError(null);
    try {
      await runManualScan(website.id, website.url, website.frequency);
    } catch {
      setError('Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handleTogglePause() {
    if (!website) return;
    await updateDoc(doc(db, 'websites', website.id), { status: website.status === 'active' ? 'paused' : 'active' });
  }

  async function handleDelete() {
    if (!website) return;
    if (!window.confirm(`Stop monitoring ${website.name}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'websites', website.id));
    window.location.href = '/dashboard';
  }

  function handleExportPdf() {
    if (!website || !user) return;
    const latestScan = scans[scans.length - 1];
    if (!latestScan) return;
    generateAuditPdf(latestScan, {
      name: user.displayName ?? 'Website Owner',
      email: user.email ?? '',
      business: website.name,
      website: website.url,
    });
  }

  function scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!user || website === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading…</div>
      </div>
    );
  }

  if (website === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold text-ink dark:text-white">Website not found</p>
        <a href="/dashboard" className="text-sm font-semibold text-brand-500 hover:underline">
          Back to dashboard
        </a>
      </div>
    );
  }

  const latest = scans[scans.length - 1];
  const previous = scans.length > 1 ? scans[scans.length - 2] : null;
  const topRecommendation = latest?.recommendations[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">
      <div id="top" className="flex flex-wrap items-center justify-between gap-4">
        <a href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate transition-colors hover:text-ink dark:hover:text-white">
          <ArrowLeft className="size-4" /> All websites
        </a>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleScanNow} loading={scanning} icon={<RefreshCw className="size-4" />}>
            {scanning ? 'Scanning…' : 'Scan Now'}
          </Button>
          <Button variant="secondary" onClick={handleTogglePause} icon={website.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}>
            {website.status === 'active' ? 'Pause' : 'Resume'}
          </Button>
          <Button variant="ghost" onClick={handleDelete} icon={<Trash2 className="size-4" />}>
            Remove
          </Button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

      <div>
        <h1 className="font-display text-2xl font-bold text-ink dark:text-white">{website.name}</h1>
        <p className="text-sm text-slate">{website.url}</p>
      </div>

      {!latest ? (
        <div className="glass rounded-[24px] p-16 text-center text-sm font-medium text-slate">No scans yet.</div>
      ) : (
        <>
          {/* ── Dashboard: what's happening today? ── */}
          <WebsiteHealthHero
            score={latest.overallScore}
            categories={latest.categories}
            recommendationCount={latest.recommendations.length}
            scannedAt={latest.scannedAt}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard static className="p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate">
                <CalendarCheck className="size-3.5" /> Monitoring
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    website.status === 'active' ? 'bg-mint-500/10 text-mint-600' : 'bg-slate/10 text-slate'
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${website.status === 'active' ? 'bg-mint-500' : 'bg-slate'}`} />
                  {website.status === 'active' ? 'Active' : 'Paused'}
                </span>
                <span className="text-xs capitalize text-slate">{website.frequency} scans</span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3 shrink-0" /> Last scan: {formatTimestamp(website.lastScannedAt)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3 shrink-0" /> Next scan: {website.frequency === 'manual' ? 'Manual only' : formatTimestamp(website.nextScanDue)}
                </div>
              </div>
            </GlassCard>

            <button type="button" onClick={() => (window.location.href = '/dashboard')} className="text-left">
              <GlassCard className="h-full p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate">
                  <Bell className="size-3.5" /> Notifications
                </div>
                <div className="font-display text-2xl font-extrabold text-ink dark:text-white">{unreadCount}</div>
                <div className="text-xs text-slate">{unreadCount === 0 ? 'All caught up' : 'Unread for this site'}</div>
              </GlassCard>
            </button>

            <button type="button" onClick={() => scrollTo('audit')} className="text-left">
              <GlassCard className="h-full p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate">
                  <Lightbulb className="size-3.5" /> Top recommendation
                </div>
                {topRecommendation ? (
                  <>
                    <div className="line-clamp-2 text-sm font-semibold text-ink dark:text-white">{topRecommendation.title}</div>
                    <div className="mt-1 text-xs capitalize text-slate">{topRecommendation.impact} impact · {topRecommendation.estimatedTime}</div>
                  </>
                ) : (
                  <div className="text-sm text-slate">No open recommendations</div>
                )}
              </GlassCard>
            </button>
          </div>

          <GlassCard static className="flex flex-wrap gap-3 p-5">
            <Button variant="secondary" size="md" icon={<MessageCircle className="size-4" />} onClick={() => scrollTo('coach')}>
              Ask AI
            </Button>
            <Button variant="secondary" size="md" icon={<LineChart className="size-4" />} onClick={() => scrollTo('monitoring')}>
              View Monitoring
            </Button>
            <Button variant="secondary" size="md" icon={<Download className="size-4" />} onClick={handleExportPdf}>
              Export PDF
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<CalendarClock className="size-4" />}
              onClick={() => window.open(CONSULTATION_URL, '_blank')}
            >
              Book Consultation
            </Button>
          </GlassCard>

          {/* ── Audit: what problems exist? ── */}
          <div id="audit" className="scroll-mt-24 space-y-6">
            <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Category Breakdown</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {latest.categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  recommendations={latest.recommendations.filter((r) => r.category === category.id)}
                />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <RadarScoreChart categories={latest.categories} />
              <SeverityBarChart recommendations={latest.recommendations} />
              <PerformanceBreakdownChart categories={latest.categories} />
            </div>
          </div>

          {/* ── AI Coach: what should I do next? ── */}
          <div className="scroll-mt-24">
            <AiCoach siteName={website.name} audit={latest} />
          </div>

          {/* ── Monitoring: what has changed over time? ── */}
          <div id="monitoring" className="scroll-mt-24 space-y-6">
            <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Monitoring</h2>
            <ScoreTrendChart scans={scans} />
            <CompetitorsSection
              websiteId={website.id}
              ourScore={latest.overallScore}
              ourCategories={latest.categories}
              siteUrl={website.url}
              pageTitle={latest.meta.pageTitle}
            />
          </div>

          {/* ── Reports: what happened previously? ── */}
          <div className="scroll-mt-24 space-y-6">
            <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Reports</h2>
            <ReportsSection
              siteName={website.name}
              siteUrl={website.url}
              userEmail={user.email ?? ''}
              userName={user.displayName ?? undefined}
              current={latest}
              previous={previous}
            />
            <ScanHistory siteName={website.name} siteUrl={website.url} scans={scans} />
          </div>
        </>
      )}
    </div>
  );
}
