import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Search,
  Gauge,
  Accessibility,
  ShieldCheck,
  Smartphone,
  MousePointerClick,
  MapPin,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import type { CategoryId, CategoryScore, Recommendation } from '../../lib/types';

const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  seo: Search,
  performance: Gauge,
  accessibility: Accessibility,
  trust: ShieldCheck,
  mobile: Smartphone,
  conversion: MousePointerClick,
  localSeo: MapPin,
};

function scoreColor(score: number): { text: string; bg: string; ring: string } {
  if (score >= 80) return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', ring: 'ring-green-500/30' };
  if (score >= 60) return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500/30' };
  if (score >= 40) return { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30' };
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/30' };
}

interface CategoryCardProps {
  category: CategoryScore;
  recommendations: Recommendation[];
}

export function CategoryCard({ category, recommendations }: CategoryCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = CATEGORY_ICONS[category.id];
  const colors = scoreColor(category.score);
  const failing = category.checks.filter((c) => !c.passed);

  return (
    <GlassCard className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 dark:text-white">{category.label}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {failing.length === 0 ? 'All checks passed' : `${failing.length} issue${failing.length === 1 ? '' : 's'} found`}
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}>
          {category.score}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="size-4 text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-black/5 px-5 py-4 dark:border-white/10">
              {category.checks.map((check) => (
                <div key={check.id} className="flex items-start gap-2 text-sm">
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{check.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{check.detail}</div>
                  </div>
                </div>
              ))}

              {recommendations.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendations</div>
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="rounded-xl bg-black/[0.03] p-3 dark:bg-white/5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{rec.title}</span>
                        <SeverityBadge severity={rec.severity} />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{rec.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Impact: <strong className="capitalize">{rec.impact}</strong></span>
                        <span>Difficulty: <strong className="capitalize">{rec.difficulty}</strong></span>
                        <span>Time: <strong>{rec.estimatedTime}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function SeverityBadge({ severity }: { severity: Recommendation['severity'] }) {
  const styles: Record<Recommendation['severity'], string> = {
    critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
    high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    info: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
  };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[severity]}`}>{severity}</span>;
}
