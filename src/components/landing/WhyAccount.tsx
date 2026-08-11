import { motion } from '../ui/motion-lite';
import { History, TrendingUp } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

// Deliberately NOT the same bullet list as HomepagePricing's Free-tier features (monitor 1
// website, weekly scans, push notifications, etc. — those are the literal plan contents, shown
// moments later in the pricing comparison below this section). This section exists to answer
// a different question — "why bother creating an account at all" — so it stays focused on the
// before/after contrast rather than repeating the same feature list twice on one page.
const FREE_ACCOUNT_BENEFITS = [
  { icon: History, text: 'See how your score changes over time, not just a one-off snapshot' },
  { icon: TrendingUp, text: "Know the moment something on your site breaks, instead of finding out from a customer" },
];

export function WhyAccount() {
  return (
    <section className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl dark:text-white">
            Want to keep improving your website?
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate">
            Create a free account to save your website, track its health over time and receive
            notifications when important issues are detected.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <GlassCard gradientBorder className="p-8">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">Free account</span>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {FREE_ACCOUNT_BENEFITS.map((benefit) => (
                <div key={benefit.text} className="flex items-center gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-500/10 text-mint-600">
                    <benefit.icon className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-ink dark:text-white">{benefit.text}</span>
                </div>
              ))}
            </div>
            <a
              href="/login?mode=signup"
              className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(120deg,#3b82f6,#4b7cff)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-12px_rgba(59,130,246,0.55)] transition-shadow hover:shadow-[0_20px_44px_-10px_rgba(59,130,246,0.65)] sm:w-auto"
            >
              Create Free Account
            </a>
          </GlassCard>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-center text-sm text-slate"
        >
          The audit above is a one-off, anonymous check — nothing is saved. A free account saves
          your website and keeps monitoring it for you.
        </motion.p>
      </div>
    </section>
  );
}
