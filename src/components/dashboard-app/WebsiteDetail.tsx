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
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Lightbulb,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { runManualScan } from '../../lib/monitoring';
import { generateAuditPdf } from '../../lib/pdf';
import { CONSULTATION_URL } from '../../lib/seo/site';
import { buildWeeklyDigest } from '../../lib/reports';
import { buildTimeline } from '../../lib/timeline';
import { buildServiceRecommendations } from '../../lib/serviceRecommendations';
import { WebsiteHealthHero } from '../dashboard/WebsiteHealthHero';
import { CategoryCard } from '../dashboard/CategoryCard';
import { RadarScoreChart, SeverityBarChart, PerformanceBreakdownChart } from '../dashboard/Charts';
import { ScoreTrendChart } from './ScoreTrendChart';
import ScoreHistoryList from './ScoreHistoryList';
import ActivityFeed from './ActivityFeed';
import AiCoach from './AiCoach';
import CompetitorsSection from './CompetitorsSection';
import ReportsSection from './ReportsSection';
import ReportHistoryList from './ReportHistoryList';
import ScanHistory from './ScanHistory';
import PageResultsList from './PageResultsList';
import { GrowthOpportunities } from '../dashboard/GrowthOpportunities';
import { HowICanHelp } from '../dashboard/HowICanHelp';
import { EnquiryModal } from '../leadgen/EnquiryModal';
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

type Section = 'top' | 'audit' | 'coach' | 'monitoring' | 'reports';

function sectionFromHash(): Section {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '');
  return hash === 'audit' || hash === 'coach' || hash === 'monitoring' || hash === 'reports' ? hash : 'top';
}

const LAST_WEBSITE_KEY = 'gaap:lastWebsiteId';

export default function WebsiteDetail({ websiteId }: WebsiteDetailProps) {
  const user = useAuthUser();
  const [website, setWebsite] = useState<WebsiteDoc | null | undefined>(undefined);
  const [scans, setScans] = useState<(AuditResult & { id: string })[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>(sectionFromHash);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiryPrefill, setEnquiryPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LAST_WEBSITE_KEY, websiteId);
  }, [websiteId]);

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

    return () => {
      unsubWebsite();
      unsubScans();
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

  function handleGetFixed(serviceTitle?: string) {
    setEnquiryPrefill(serviceTitle);
    setEnquiryOpen(true);
  }

  function goTo(next: Section) {
    window.location.hash = next;
    setSection(next);
    window.scrollTo({ top: 0 });
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
  const digest = latest ? buildWeeklyDigest(website.name, website.url, latest, previous) : null;
  const timeline = buildTimeline(scans);

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
        <a
          href={website.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-slate transition-colors hover:text-brand-500"
        >
          Visit site <ExternalLink className="size-3" />
        </a>
      </div>

      {!latest ? (
        <div className="glass rounded-[24px] p-16 text-center text-sm font-medium text-slate">No scans yet.</div>
      ) : section === 'top' ? (
        <>
          {/* ── Dashboard: what needs my attention? ── */}
          <WebsiteHealthHero
            score={latest.overallScore}
            categories={latest.categories}
            recommendationCount={latest.recommendations.length}
            scannedAt={latest.scannedAt}
            scoreDelta={digest?.scoreDelta ?? null}
            scanQuality={latest.meta.scanQuality}
            auditQuality={latest.meta.auditQuality}
          />

          <div className="grid gap-4 sm:grid-cols-2">
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

            <GlassCard static className="p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate">
                <ListChecks className="size-3.5" /> Issues
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 font-display text-xl font-extrabold text-amber-600">
                    <AlertTriangle className="size-3.5" /> {digest?.newIssues.length ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate">New</div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 font-display text-xl font-extrabold text-mint-600">
                    <CheckCircle2 className="size-3.5" /> {digest?.resolvedIssues.length ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate">Fixed</div>
                </div>
                <div>
                  <div className="font-display text-xl font-extrabold text-ink dark:text-white">{latest.recommendations.length}</div>
                  <div className="mt-0.5 text-[11px] text-slate">Open</div>
                </div>
              </div>
            </GlassCard>
          </div>

          <button type="button" onClick={() => goTo('audit')} className="block w-full text-left">
            <GlassCard className="p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate">
                  <Lightbulb className="size-3.5" /> Top priority
                </span>
                <ArrowRight className="size-3.5 text-slate" />
              </div>
              {topRecommendation ? (
                <>
                  <div className="font-semibold text-ink dark:text-white">{topRecommendation.title}</div>
                  <div className="mt-1 text-xs capitalize text-slate">
                    {topRecommendation.impact} impact · {topRecommendation.difficulty} · {topRecommendation.estimatedTime}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate">No open recommendations — nice work.</div>
              )}
            </GlassCard>
          </button>

          <GlassCard static className="p-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate">Recent Activity</h3>
            <ActivityFeed entries={timeline} limit={5} emptyLabel="No activity yet — your first scan will appear here." />
          </GlassCard>

          <GlassCard static className="flex flex-wrap gap-3 p-5">
            <Button variant="secondary" size="md" icon={<MessageCircle className="size-4" />} onClick={() => goTo('coach')}>
              Ask AI
            </Button>
            <Button variant="secondary" size="md" icon={<LineChart className="size-4" />} onClick={() => goTo('monitoring')}>
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
        </>
      ) : section === 'audit' ? (
        /* ── Audit: what problems exist? ── */
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Category Breakdown</h2>
          <PageResultsList audit={latest} />
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

          <GrowthOpportunities recommendations={latest.recommendations} />

          <HowICanHelp audit={latest} onGetFixed={handleGetFixed} onAskAi={() => goTo('coach')} />
        </div>
      ) : section === 'coach' ? (
        /* ── AI Coach: what should I do next? ── */
        <AiCoach websiteId={website.id} siteName={website.name} audit={latest} previous={previous} />
      ) : section === 'monitoring' ? (
        /* ── Monitoring: what has changed? ── */
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Monitoring</h2>

          <GlassCard static className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className={`size-1.5 rounded-full ${website.status === 'active' ? 'bg-mint-500' : 'bg-slate'}`} />
              {website.status === 'active' ? 'Active' : 'Paused'}
            </span>
            <span className="capitalize text-slate">{website.frequency} scans</span>
            <span className="text-slate">Last scan: {formatTimestamp(website.lastScannedAt)}</span>
            <span className="text-slate">
              Next scan: {website.frequency === 'manual' ? 'Manual only' : formatTimestamp(website.nextScanDue)}
            </span>
          </GlassCard>

          {scans.length < 2 ? (
            <GlassCard static className="p-8 text-center text-sm text-slate">
              Your first scan establishes your baseline. Changes will appear here after your next scan.
            </GlassCard>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassCard static className="p-6">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate">Score History</h3>
                  <ScoreHistoryList scans={scans} />
                </GlassCard>
                <ScoreTrendChart scans={scans} />
              </div>

              <GlassCard static className="p-6">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate">Changes Detected</h3>
                <ActivityFeed entries={timeline} showFilters emptyLabel="No changes match this filter." />
              </GlassCard>
            </>
          )}

          <CompetitorsSection
            websiteId={website.id}
            ourScore={latest.overallScore}
            ourCategories={latest.categories}
            siteUrl={website.url}
            pageTitle={latest.meta.pageTitle}
          />
        </div>
      ) : (
        /* ── Reports: what happened previously? ── */
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Reports</h2>
          <ReportsSection
            siteName={website.name}
            siteUrl={website.url}
            userName={user.displayName ?? undefined}
            current={latest}
            previous={previous}
          />

          <GlassCard static className="p-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate">Report History</h3>
            <ReportHistoryList
              scans={scans}
              frequency={website.frequency}
              websiteName={website.name}
              websiteUrl={website.url}
              userName={user.displayName ?? ''}
              userEmail={user.email ?? ''}
            />
          </GlassCard>

          <ScanHistory siteName={website.name} siteUrl={website.url} scans={scans} />
        </div>
      )}

      {latest && (
        <EnquiryModal
          open={enquiryOpen}
          onClose={() => setEnquiryOpen(false)}
          audit={latest}
          initialHelpWith={enquiryPrefill}
          recommendedServices={buildServiceRecommendations(latest).map((s) => s.title)}
        />
      )}
    </div>
  );
}
