import { motion } from 'framer-motion';
import { TrendingUp, Eye, MousePointerClick, Zap, Accessibility } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import type { GrowthEstimate as GrowthEstimateType } from '../../lib/types';
import { AnimatedCounter } from '../ui/AnimatedCounter';

interface GrowthEstimateProps {
  estimate: GrowthEstimateType;
}

export function GrowthEstimateSection({ estimate }: GrowthEstimateProps) {
  const items = [
    {
      icon: TrendingUp,
      label: 'Additional enquiries / month',
      value: `+${estimate.additionalEnquiriesPerMonth[0]}-${estimate.additionalEnquiriesPerMonth[1]}`,
      isRange: true,
      gauge: Math.min(100, estimate.additionalEnquiriesPerMonth[1] * 4),
    },
    { icon: Eye, label: 'Google visibility', suffix: '%', value: estimate.visibilityImprovementPct, gauge: estimate.visibilityImprovementPct },
    { icon: MousePointerClick, label: 'Conversion rate', suffix: '%', value: estimate.conversionImprovementPct, gauge: estimate.conversionImprovementPct },
    { icon: Zap, label: 'Site speed', suffix: '%', value: estimate.speedImprovementPct, gauge: estimate.speedImprovementPct },
    { icon: Accessibility, label: 'Accessibility', suffix: '%', value: estimate.accessibilityImprovementPct, gauge: estimate.accessibilityImprovementPct },
  ];

  return (
    <div>
      <div className="mb-10 text-center sm:text-left">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Growth Potential</span>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl dark:text-white">
          What fixing this could mean
        </h2>
        <p className="mt-3 text-slate">
          Estimated from the issues detected in this audit — a directional guide, not a guarantee.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard gradientBorder className="flex h-full flex-col gap-4 p-6">
              <div className="flex items-start justify-between">
                <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#4b7cff)] text-white shadow-[0_12px_24px_-8px_rgba(59,130,246,0.55)]">
                  <item.icon className="size-5" />
                </div>
                <MiniGauge value={item.gauge} />
              </div>
              <div>
                <div className="font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">
                  {item.isRange ? item.value : (
                    <>
                      +<AnimatedCounter value={item.value as number} />
                      {item.suffix}
                    </>
                  )}
                </div>
                <div className="mt-1 text-sm font-medium text-slate">{item.label}</div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MiniGauge({ value }: { value: number }) {
  const size = 36;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-ink/[0.06] dark:text-white/10" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#00c48c"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        whileInView={{ strokeDashoffset: circumference - (clamped / 100) * circumference }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
