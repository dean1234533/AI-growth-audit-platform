import { useState } from 'react';
import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, ScanLine } from 'lucide-react';
import type { TimelineEntry, TimelineEntryType } from '../../lib/timeline';

const TYPE_ICON: Record<TimelineEntryType, typeof ScanLine> = {
  scan_completed: ScanLine,
  issue_detected: AlertTriangle,
  issue_fixed: CheckCircle2,
  score_improved: TrendingUp,
  score_worsened: TrendingDown,
};

const TYPE_COLOR: Record<TimelineEntryType, string> = {
  scan_completed: 'bg-slate/10 text-slate',
  issue_detected: 'bg-amber-500/10 text-amber-600',
  issue_fixed: 'bg-mint-500/10 text-mint-600',
  score_improved: 'bg-mint-500/10 text-mint-600',
  score_worsened: 'bg-rose-500/10 text-rose-500',
};

const FILTERS: { id: 'all' | TimelineEntryType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'issue_detected', label: 'New' },
  { id: 'issue_fixed', label: 'Fixed' },
  { id: 'score_improved', label: 'Improved' },
  { id: 'score_worsened', label: 'Worsened' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface ActivityFeedProps {
  entries: TimelineEntry[];
  /** Show only the N most recent entries, no filter chips — used on the Dashboard's compact feed. */
  limit?: number;
  /** Show filter chips (All/New/Fixed/Improved/Worsened) — used on the full Monitoring feed. */
  showFilters?: boolean;
  emptyLabel?: string;
}

export default function ActivityFeed({ entries, limit, showFilters, emptyLabel = 'No activity yet.' }: ActivityFeedProps) {
  const [filter, setFilter] = useState<'all' | TimelineEntryType>('all');

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.type === filter);
  const visible = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.id ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-slate hover:text-ink dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-slate">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => {
            const Icon = TYPE_ICON[entry.type];
            return (
              <div key={entry.id} className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${TYPE_COLOR[entry.type]}`}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink dark:text-white">{entry.title}</span>
                    <span className="shrink-0 text-xs text-slate">{formatDate(entry.date)}</span>
                  </div>
                  {entry.detail && <div className="text-xs text-slate">{entry.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
