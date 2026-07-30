import { useState } from 'react';
import { FileText, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { buildWeeklyDigest } from '../../lib/reports';
import type { AuditResult } from '../../lib/types';

interface ReportsSectionProps {
  siteName: string;
  siteUrl: string;
  userEmail: string;
  current: AuditResult;
  previous: AuditResult | null;
}

export default function ReportsSection({ siteName, siteUrl, userEmail, current, previous }: ReportsSectionProps) {
  const digest = buildWeeklyDigest(siteName, siteUrl, current, previous);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleEmail() {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: userEmail, digest }),
      });
      const json = (await res.json()) as { sent?: boolean; reason?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong');
      setStatus(json.sent ? `Sent to ${userEmail}.` : (json.reason ?? 'Email delivery is not configured yet.'));
    } catch {
      setStatus('Could not send the report. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <GlassCard gradientBorder id="reports" className="p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white">
            <FileText className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink dark:text-white">Weekly Report</h3>
            <p className="text-xs text-slate">What changed since the last scan</p>
          </div>
        </div>
        <Button size="md" variant="secondary" icon={<Mail className="size-4" />} onClick={handleEmail} loading={sending}>
          Email Me This
        </Button>
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

      {status && <p className="mt-4 text-xs font-medium text-slate">{status}</p>}
    </GlassCard>
  );
}
