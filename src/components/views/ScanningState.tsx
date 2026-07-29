import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ScanSearch, Search, Gauge, ShieldCheck, Smartphone } from 'lucide-react';
import { FloatingBackground } from '../landing/FloatingBackground';
import { GlassCard } from '../ui/GlassCard';
import { Skeleton } from '../ui/Skeleton';

const STAGES = [
  { icon: Search, label: 'Scanning SEO signals…' },
  { icon: Gauge, label: 'Measuring performance & Core Web Vitals…' },
  { icon: ShieldCheck, label: 'Checking trust & credibility signals…' },
  { icon: Smartphone, label: 'Reviewing mobile experience…' },
  { icon: ScanSearch, label: 'Generating your recommendations…' },
];

export function ScanningState() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const Current = STAGES[stage];

  return (
    <div className="relative flex min-h-[85vh] items-center justify-center px-6">
      <FloatingBackground />
      <div className="relative w-full max-w-lg">
        <GlassCard gradientBorder static className="p-12 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="relative mx-auto mb-8 inline-flex size-20 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white shadow-[0_20px_44px_-12px_rgba(108,99,255,0.6)]"
          >
            <div className="animate-glow-pulse absolute inset-0 rounded-3xl bg-brand-500/40 blur-xl" />
            <Current.icon className="relative size-9" />
          </motion.div>
          <h2 className="font-display text-2xl font-bold text-ink dark:text-white">Analysing your website</h2>
          <motion.p key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 text-sm font-medium text-slate">
            {Current.label}
          </motion.p>

          <div className="mt-10 space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>

          <div className="mt-8 flex justify-center gap-2">
            {STAGES.map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 w-9 rounded-full"
                animate={{ backgroundColor: i <= stage ? '#6c63ff' : 'rgba(108,99,255,0.12)' }}
                transition={{ duration: 0.4 }}
              />
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
