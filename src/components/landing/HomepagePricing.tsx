import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { PLANS } from '../../lib/plans';

// Pulls straight from src/lib/plans.ts, which itself derives its numbers from
// src/server/lib/access.ts — the same source the server actually enforces
// against. Never hardcode a price/limit/feature here; it must always match
// what the product actually does. Admin is an internal role, never shown here.
const FREE = PLANS.find((p) => p.id === 'free')!;
const PRO = PLANS.find((p) => p.id === 'pro')!;

export function HomepagePricing() {
  return (
    <section className="relative px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Pricing</span>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl dark:text-white">
            Simple, honest pricing
          </h2>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard className="flex h-full flex-col p-8">
              <span className="text-xs font-bold uppercase tracking-wide text-mint-600">{FREE.name}</span>
              <div className="mt-3 font-display text-4xl font-extrabold text-ink dark:text-white">{FREE.price}</div>
              <p className="mt-2 text-sm text-slate">Try Growth Audit and monitor one website.</p>
              <div className="mt-5 rounded-xl bg-ink/[0.03] px-4 py-2.5 text-sm font-semibold text-ink dark:bg-white/[0.04] dark:text-white">
                {FREE.websiteLimit} website
              </div>
              <ul className="mt-5 space-y-2.5">
                {/* "Free website audit" isn't plan-gated (anyone can run one, no account needed)
                    so it's shown here as context rather than added to the shared PLANS feature
                    list, which only describes what an account/plan unlocks. */}
                <li className="flex items-start gap-2.5 text-sm text-slate">
                  <Check className="mt-0.5 size-4 shrink-0 text-mint-500" /> Free website audit
                </li>
                {FREE.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate">
                    <Check className="mt-0.5 size-4 shrink-0 text-mint-500" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href="/login?mode=signup"
                className="glass mt-8 block rounded-2xl px-5 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-white/60 dark:text-white dark:hover:bg-white/10"
              >
                Create Free Account
              </a>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard gradientBorder className="flex h-full flex-col p-8">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-600">{PRO.name}</span>
              <div className="mt-3 font-display text-4xl font-extrabold text-ink dark:text-white">{PRO.price}</div>
              <p className="mt-2 text-sm text-slate">Monitor up to {PRO.websiteLimit} websites and unlock advanced features.</p>
              <div className="mt-5 rounded-xl bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-brand-600">
                Up to {PRO.websiteLimit} websites
              </div>
              <ul className="mt-5 space-y-2.5">
                {PRO.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-500" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href="/pricing"
                className="mt-8 block rounded-2xl bg-[linear-gradient(120deg,#3b82f6,#4b7cff)] px-5 py-3 text-center text-sm font-semibold text-white shadow-[0_16px_36px_-12px_rgba(59,130,246,0.55)] transition-shadow hover:shadow-[0_20px_44px_-10px_rgba(59,130,246,0.65)]"
              >
                Upgrade
              </a>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
