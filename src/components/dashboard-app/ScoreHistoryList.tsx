import type { AuditResult } from '../../lib/types';

interface ScoreHistoryListProps {
  scans: (AuditResult & { id: string })[];
}

export default function ScoreHistoryList({ scans }: ScoreHistoryListProps) {
  const ordered = [...scans].reverse();

  return (
    <div className="divide-y divide-ink/[0.06] dark:divide-white/10">
      {ordered.map((scan, i) => {
        const prev = ordered[i + 1];
        const delta = prev ? scan.overallScore - prev.overallScore : null;
        return (
          <div key={scan.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-slate">
              {new Date(scan.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-display font-bold text-ink dark:text-white">{scan.overallScore}</span>
              {delta !== null && delta !== 0 && (
                <span className={`text-xs font-bold ${delta > 0 ? 'text-mint-600' : 'text-rose-500'}`}>
                  {delta > 0 ? '+' : ''}
                  {delta}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
