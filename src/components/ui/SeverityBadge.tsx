import type { Severity } from '../../lib/types';

const STYLES: Record<Severity, string> = {
  critical: 'bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-400',
  high: 'bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-400',
  medium: 'bg-brand-500/12 text-brand-700 ring-brand-500/25 dark:text-brand-300',
  low: 'bg-accent-500/12 text-accent-600 ring-accent-500/25 dark:text-accent-400',
  info: 'bg-slate/10 text-slate ring-slate/20',
};

const DOT: Record<Severity, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-brand-500',
  low: 'bg-accent-500',
  info: 'bg-slate',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${STYLES[severity]}`}>
      <span className={`size-1.5 rounded-full ${DOT[severity]}`} />
      {severity}
    </span>
  );
}
