import { motion } from 'framer-motion';
import { Sparkles, Clock, ListChecks } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { ScoreCircle } from './ScoreCircle';
import { scoreBand } from '../../lib/scoreBand';
import type { CategoryScore } from '../../lib/types';

interface WebsiteHealthHeroProps {
  score: number;
  categories: CategoryScore[];
  recommendationCount: number;
  scannedAt: string;
}

export function WebsiteHealthHero({ score, categories, recommendationCount, scannedAt }: WebsiteHealthHeroProps) {
  const { label, color } = scoreBand(score);
  const sorted = [...categories].filter((c) => c.checks.length > 0).sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
      <GlassCard gradientBorder className="relative overflow-hidden p-10 sm:p-14">
        <div className="pointer-events-none absolute -right-32 -top-32 size-[26rem] rounded-full bg-brand-400/20 blur-[100px]" />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full bg-mint-400/15 blur-[90px]" />

        <div className="relative flex flex-col items-center gap-12 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              <Sparkles className="size-3.5" /> Website Health
            </span>

            <div className="mt-6">
              <ScoreCircle score={score} size={240} />
            </div>

            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.4, type: 'spring', stiffness: 260, damping: 20 }}
              className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ring-1 ring-inset"
              style={{ color, backgroundColor: `${color}18`, borderColor: `${color}40` }}
            >
              {label}
            </motion.span>
          </div>

          <div className="w-full max-w-sm space-y-5 text-center sm:text-left">
            <p className="text-lg leading-relaxed text-slate">
              We identified <strong className="font-bold text-ink dark:text-white">{recommendationCount} opportunities</strong> to
              improve enquiries, visibility and conversion across your site.
            </p>

            {strongest && weakest && strongest.id !== weakest.id && (
              <div className="space-y-3">
                <StatRow label="Strongest category" name={strongest.label} value={strongest.score} positive />
                <StatRow label="Needs the most attention" name={weakest.label} value={weakest.score} positive={false} />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm font-medium text-slate sm:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="size-4 text-brand-500" />
                {categories.filter((c) => c.checks.length > 0).length} categories analysed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-brand-500" />
                Scanned {new Date(scannedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function StatRow({ label, name, value, positive }: { label: string; name: string; value: number; positive: boolean }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate">{label}</div>
          <div className="font-semibold text-ink dark:text-white">{name}</div>
        </div>
        <div className={`font-display text-xl font-extrabold ${positive ? 'text-mint-600' : 'text-amber-600'}`}>{value}</div>
      </div>
    </div>
  );
}
