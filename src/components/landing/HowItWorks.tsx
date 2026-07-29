import { motion } from 'framer-motion';
import { ScanSearch, Lightbulb, TrendingUp } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

const STEPS = [
  {
    icon: ScanSearch,
    title: 'Scan',
    description: 'We analyse your website using multiple AI-powered checks across SEO, speed, trust and more.',
  },
  {
    icon: Lightbulb,
    title: 'Discover',
    description: 'We identify the specific technical, SEO and conversion problems holding your site back.',
  },
  {
    icon: TrendingUp,
    title: 'Improve',
    description: 'Receive prioritised, actionable recommendations to turn more visitors into enquiries.',
  },
];

export function HowItWorks() {
  return (
    <section className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">How it works</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            A complete website growth audit, done automatically in three steps.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <GlassCard className="group h-full p-8 transition-transform hover:-translate-y-1">
                <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25">
                  <step.icon className="size-6" />
                </div>
                <div className="mb-1 text-sm font-semibold text-brand-500">Step {i + 1}</div>
                <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-slate-600 dark:text-slate-300">{step.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
