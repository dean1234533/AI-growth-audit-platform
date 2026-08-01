import { motion } from 'framer-motion';
import { Search, Link2, Gauge, Smartphone, Accessibility, MousePointerClick, MapPin } from 'lucide-react';

const CHANGES = [
  { icon: Search, label: 'SEO issues' },
  { icon: Link2, label: 'Broken links' },
  { icon: Gauge, label: 'Performance problems' },
  { icon: Smartphone, label: 'Mobile problems' },
  { icon: Accessibility, label: 'Accessibility issues' },
  { icon: MousePointerClick, label: 'Conversion problems' },
  { icon: MapPin, label: 'Local SEO issues' },
];

export function WhyMonitoring() {
  return (
    <section className="relative px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Why monitoring matters</span>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl dark:text-white">
            Your website can change without you noticing
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate">
            Websites change. Pages get removed, links break, performance drops and SEO issues
            appear. Growth Audit checks your website automatically so you don't have to remember
            to.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3"
        >
          {CHANGES.map((change) => (
            <span
              key={change.label}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink dark:text-white"
            >
              <change.icon className="size-4 text-brand-500" /> {change.label}
            </span>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-8 max-w-xl text-lg font-semibold leading-relaxed text-ink dark:text-white"
        >
          Get notified when something needs attention.
        </motion.p>
      </div>
    </section>
  );
}
