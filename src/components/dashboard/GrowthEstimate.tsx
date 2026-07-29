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
      value: `${estimate.additionalEnquiriesPerMonth[0]}-${estimate.additionalEnquiriesPerMonth[1]}`,
      isRange: true,
    },
    { icon: Eye, label: 'Visibility improvement', suffix: '%', value: estimate.visibilityImprovementPct },
    { icon: MousePointerClick, label: 'Conversion improvement', suffix: '%', value: estimate.conversionImprovementPct },
    { icon: Zap, label: 'Speed improvement', suffix: '%', value: estimate.speedImprovementPct },
    { icon: Accessibility, label: 'Accessibility improvement', suffix: '%', value: estimate.accessibilityImprovementPct },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Estimated Growth Potential</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Based on the issues detected in this audit. These are estimates, not guaranteed outcomes.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <GlassCard className="flex h-full flex-col items-start gap-3 p-5">
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <item.icon className="size-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {item.isRange ? (
                  item.value
                ) : (
                  <>
                    +<AnimatedCounter value={item.value as number} />
                    {item.suffix}
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
