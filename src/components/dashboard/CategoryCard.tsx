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
import { SeverityBadge } from '../ui/SeverityBadge';
import { scoreBand } from '../../lib/scoreBand';
import type { CategoryScore, MeasurementType, Recommendation } from '../../lib/types';

/**
 * Only 'measured' (real browser data) and 'inferred'/'not_available' (lower confidence, or
 * genuinely unavailable) get a badge — 'detected' is the common baseline (a real fact from the
 * actual HTTP response/HTML) and needs no extra decoration. Never lets an inference read as a
 * measured fact.
 */
function MeasurementBadge({ type }: { type: MeasurementType | undefined }) {
  if (!type || type === 'detected') return null;
  const config: Record<Exclude<MeasurementType, 'detected'>, { label: string; className: string }> = {
    measured: { label: 'Measured', className: 'bg-brand-500/10 text-brand-600 dark:text-brand-300' },
    inferred: { label: 'Estimate', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    not_available: { label: 'Not measured', className: 'bg-slate/10 text-slate' },
  };
  const entry = config[type];
  if (!entry) return null;
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${entry.className}`}>{entry.label}</span>;
}

const CATEGORY_ICONS: Record<CategoryScore['id'], LucideIcon> = {
  seo: Search,
  performance: Gauge,
  accessibility: Accessibility,
  trust: ShieldCheck,
  mobile: Smartphone,
  conversion: MousePointerClick,
  localSeo: MapPin,
};

interface CategoryCardProps {
  category: CategoryScore;
  recommendations: Recommendation[];
}

export function CategoryCard({ category, recommendations }: CategoryCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = CATEGORY_ICONS[category.id];
  const { label, color, textClass, bgClass, ringClass } = scoreBand(category.score);
  const failing = category.checks.filter((c) => !c.passed);
  const circumference = 2 * Math.PI * 20;

  return (
    <GlassCard gradientBorder className="overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-col gap-5 p-6 text-left">
        <div className="flex items-start justify-between">
          <div className={`inline-flex size-12 items-center justify-center rounded-2xl ${bgClass} ${textClass} shadow-inner`}>
            <Icon className="size-5.5" />
          </div>
          <div className="relative size-11 shrink-0">
            <svg width={44} height={44} className="-rotate-90">
              <circle cx={22} cy={22} r={20} stroke="currentColor" strokeWidth={4} fill="none" className="text-ink/[0.06] dark:text-white/10" />
              <circle
                cx={22}
                cy={22}
                r={20}
                stroke={color}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (category.score / 100) * circumference}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
              />
            </svg>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate">{category.label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold tracking-tight text-ink dark:text-white">{category.score}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${bgClass} ${textClass} ${ringClass}`}>{label}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate">
            {failing.length === 0 ? 'All checks passed' : `${failing.length} issue${failing.length === 1 ? '' : 's'} found`}
          </span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown className="size-4 text-slate" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 border-t border-ink/[0.06] px-6 py-5 dark:border-white/10">
              {category.checks.map((check) => (
                <div key={check.id} className="flex items-start gap-2.5 text-sm">
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-ink dark:text-slate-100">{check.label}</span>
                      <MeasurementBadge type={check.measurementType} />
                    </div>
                    <div className="text-xs text-slate">{check.detail}</div>
                  </div>
                </div>
              ))}

              {recommendations.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-ink/[0.06] pt-5 dark:border-white/10">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate">Recommendations</div>
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="glass rounded-2xl p-4">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink dark:text-white">{rec.title}</span>
                        <SeverityBadge severity={rec.severity} />
                      </div>
                      <p className="text-xs leading-relaxed text-slate">{rec.description}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate">
                        <span>Impact: <strong className="capitalize text-ink dark:text-white">{rec.impact}</strong></span>
                        <span>Difficulty: <strong className="capitalize text-ink dark:text-white">{rec.difficulty}</strong></span>
                        <span>Time: <strong className="text-ink dark:text-white">{rec.estimatedTime}</strong></span>
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
