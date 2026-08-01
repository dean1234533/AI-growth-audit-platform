import { motion } from 'framer-motion';
import { ScanSearch, Lightbulb, TrendingUp } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

const STEPS = [
  {
    icon: ScanSearch,
    title: 'Scan',
    description: 'Run a full website audit.',
  },
  {
    icon: Lightbulb,
    title: 'Discover',
    description: 'Find SEO, performance, accessibility, conversion and local SEO issues.',
  },
  {
    icon: TrendingUp,
    title: 'Improve',
    description: 'Get prioritised recommendations and monitor your website for changes.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 px-6 py-28 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-20 max-w-2xl text-center"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">How it works</span>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl dark:text-white">
            Three steps to clarity
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate">
            A complete website growth audit, done automatically — no forms, no waiting on an agency.
          </p>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.14, ease: [0.16, 1, 0.3, 1] }}
            >
              <GlassCard gradientBorder className="relative h-full overflow-hidden p-10">
                <span className="font-display absolute -right-2 -top-6 text-[7rem] font-black leading-none text-brand-500/[0.06] dark:text-white/[0.04]">
                  {i + 1}
                </span>
                <div className="relative mb-7 inline-flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#4b7cff)] text-white shadow-[0_16px_32px_-10px_rgba(59,130,246,0.55)]">
                  <step.icon className="size-6" />
                </div>
                <div className="relative mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-500">
                  Step {i + 1}
                </div>
                <h3 className="relative mb-3 font-display text-2xl font-bold text-ink dark:text-white">{step.title}</h3>
                <p className="relative leading-relaxed text-slate">{step.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
