import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ScanSearch, Search, Gauge, ShieldCheck, Smartphone } from 'lucide-react';
import { FloatingBackground } from '../components/landing/FloatingBackground';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';

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
    <div className="relative flex min-h-[80vh] items-center justify-center px-6">
      <FloatingBackground />
      <div className="relative w-full max-w-lg">
        <GlassCard className="p-10 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
            className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white"
          >
            <Current.icon className="size-8" />
          </motion.div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analysing your website</h2>
          <motion.p key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {Current.label}
          </motion.p>

          <div className="mt-8 space-y-2.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>

          <div className="mt-6 flex justify-center gap-1.5">
            {STAGES.map((_, i) => (
              <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i <= stage ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'}`} />
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
