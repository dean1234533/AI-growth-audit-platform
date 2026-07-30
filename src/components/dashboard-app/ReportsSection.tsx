import { useEffect, useState } from 'react';
import { Sparkles, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { buildWeeklyDigest } from '../../lib/reports';
import type { AuditResult } from '../../lib/types';

interface ReportsSectionProps {
  siteName: string;
  siteUrl: string;
  userName?: string;
  current: AuditResult;
  previous: AuditResult | null;
}

export default function ReportsSection({ siteName, siteUrl, userName, current, previous }: ReportsSectionProps) {
  const digest = buildWeeklyDigest(siteName, siteUrl, current, previous);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    fetch('/api/report-summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ digest, userName }),
    })
      .then((res) => res.json() as Promise<{ summary?: string }>)
      .then((json) => {
        if (!cancelled) setAiSummary(json.summary ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.scannedAt]);

  return (
    <GlassCard gradientBorder id="reports" className="p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white">
          <FileText className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold text-ink dark:text-white">Weekly Report</h3>
          <p className="text-xs text-slate">What changed since the last scan</p>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-brand-500/[0.06] px-4 py-3.5 ring-1 ring-inset ring-brand-500/10">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-500" />
        {summaryLoading ? (
          <span className="h-4 w-2/3 animate-pulse rounded bg-brand-500/15" />
        ) : (
          <p className="text-sm leading-relaxed text-ink dark:text-slate-100">{aiSummary}</p>
        )}
      </div>

      <div className="mb-5 flex items-center gap-3">
        <span className="font-display text-3xl font-extrabold text-ink dark:text-white">{digest.currentScore}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            digest.scoreDelta === null
              ? 'bg-slate/10 text-slate'
              : digest.scoreDelta > 0
                ? 'bg-mint-500/10 text-mint-600'
                : digest.scoreDelta < 0
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-slate/10 text-slate'
          }`}
        >
          {digest.scoreDelta === null ? 'First scan' : digest.scoreDelta === 0 ? 'No change' : `${digest.scoreDelta > 0 ? '+' : ''}${digest.scoreDelta} this week`}
        </span>
      </div>

      {digest.resolvedIssues.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">Resolved</div>
          <div className="space-y-1.5">
            {digest.resolvedIssues.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm text-ink dark:text-slate-100">
                <CheckCircle2 className="size-4 shrink-0 text-mint-500" /> {r.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {digest.newIssues.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">New this scan</div>
          <div className="space-y-1.5">
            {digest.newIssues.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm text-ink dark:text-slate-100">
                <AlertTriangle className="size-4 shrink-0 text-amber-500" /> {r.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {digest.resolvedIssues.length === 0 && digest.newIssues.length === 0 && previous && (
        <p className="text-sm text-slate">No new or resolved issues since the last scan.</p>
      )}
    </GlassCard>
  );
}
