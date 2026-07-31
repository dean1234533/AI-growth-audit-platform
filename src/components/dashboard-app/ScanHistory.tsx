import { useMemo, useState } from 'react';
import { History, ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { buildWeeklyDigest } from '../../lib/reports';
import type { AuditResult } from '../../lib/types';

interface ScanHistoryProps {
  siteName: string;
  siteUrl: string;
  scans: (AuditResult & { id: string })[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate/10 px-2 py-0.5 text-xs font-bold text-slate">
        <Minus className="size-3" /> 0
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        positive ? 'bg-mint-500/10 text-mint-600' : 'bg-rose-500/10 text-rose-500'
      }`}
    >
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {positive ? '+' : ''}
      {delta}
    </span>
  );
}

export default function ScanHistory({ siteName, siteUrl, scans }: ScanHistoryProps) {
  // Newest first for the list; scans prop arrives oldest-first (matches the trend chart's expectations).
  const ordered = useMemo(() => [...scans].reverse(), [scans]);
  const [beforeId, setBeforeId] = useState<string | null>(ordered[1]?.id ?? null);
  const [afterId, setAfterId] = useState<string | null>(ordered[0]?.id ?? null);

  const before = ordered.find((s) => s.id === beforeId) ?? null;
  const after = ordered.find((s) => s.id === afterId) ?? null;

  const digest = after ? buildWeeklyDigest(siteName, siteUrl, after, before) : null;

  if (scans.length === 0) return null;

  return (
    <GlassCard gradientBorder className="p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#4b7cff)] text-white">
          <History className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold text-ink dark:text-white">Compare Reports</h3>
          <p className="text-xs text-slate">Compare any two reports to see exactly what changed</p>
        </div>
      </div>

      {scans.length >= 2 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-ink/[0.03] p-3 dark:bg-white/[0.03]">
          <select
            value={beforeId ?? ''}
            onChange={(e) => setBeforeId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink outline-none dark:border-white/10 dark:bg-[#0a0a12] dark:text-white"
          >
            {ordered.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === afterId}>
                {formatDate(s.scannedAt)} — {s.overallScore}/100
              </option>
            ))}
          </select>
          <ArrowRight className="size-4 shrink-0 text-slate" />
          <select
            value={afterId ?? ''}
            onChange={(e) => setAfterId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-canvas px-3 py-2 text-xs font-semibold text-ink outline-none dark:border-white/10 dark:bg-[#0a0a12] dark:text-white"
          >
            {ordered.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === beforeId}>
                {formatDate(s.scannedAt)} — {s.overallScore}/100
              </option>
            ))}
          </select>
        </div>
      )}

      {digest && after && (
        <>
          <div className="mb-6 flex items-center gap-4">
            <div>
              <div className="text-xs font-semibold text-slate">{before ? formatDate(before.scannedAt) : 'First scan'}</div>
              <div className="font-display text-2xl font-extrabold text-ink dark:text-white">{before?.overallScore ?? '—'}</div>
            </div>
            <ArrowRight className="size-5 text-slate" />
            <div>
              <div className="text-xs font-semibold text-slate">{formatDate(after.scannedAt)}</div>
              <div className="font-display text-2xl font-extrabold text-ink dark:text-white">{after.overallScore}</div>
            </div>
            {digest.scoreDelta !== null && <DeltaBadge delta={digest.scoreDelta} />}
          </div>

          {before && (
            <div className="mb-6 grid gap-2 sm:grid-cols-2">
              {after.categories.map((cat) => {
                const prevCat = before.categories.find((c) => c.id === cat.id);
                const delta = prevCat ? cat.score - prevCat.score : 0;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.03] px-3.5 py-2.5 text-sm dark:bg-white/[0.03]"
                  >
                    <span className="font-semibold text-ink dark:text-white">{cat.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate">{cat.score}</span>
                      <DeltaBadge delta={delta} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}

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
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">New</div>
              <div className="space-y-1.5">
                {digest.newIssues.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm text-ink dark:text-slate-100">
                    <AlertTriangle className="size-4 shrink-0 text-amber-500" /> {r.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {digest.resolvedIssues.length === 0 && digest.newIssues.length === 0 && before && (
            <p className="text-sm text-slate">No issues changed between these two scans.</p>
          )}
        </>
      )}
    </GlassCard>
  );
}
