import { motion } from '../ui/motion-lite';
import { Search, Gauge, Smartphone, MousePointerClick } from 'lucide-react';

const CHECKS = [
  { icon: Search, label: 'SEO checks' },
  { icon: Gauge, label: 'Performance checks' },
  { icon: Smartphone, label: 'Mobile & accessibility checks' },
  { icon: MousePointerClick, label: 'Conversion & local SEO checks' },
];

export function TryFreeAudit() {
  return (
    <section className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl dark:text-white">
            Try the audit before you sign up
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate">
            Enter any website and get a free website health report. No account required and nothing is saved.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-3"
        >
          {CHECKS.map((check) => (
            <span
              key={check.label}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink dark:text-white"
            >
              <check.icon className="size-4 text-brand-500" /> {check.label}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="mt-8"
        >
          <a
            href="#top"
            className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(120deg,#3b82f6,#4b7cff)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-12px_rgba(59,130,246,0.55)] transition-shadow hover:shadow-[0_20px_44px_-10px_rgba(59,130,246,0.65)]"
          >
            Start Free Audit
          </a>
        </motion.div>
      </div>
    </section>
  );
}
