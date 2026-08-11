import { useState, type FormEvent } from 'react';
import { motion } from '../ui/motion-lite';
import { Globe, Sparkles, ArrowRight, Zap, Search, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import type { AuditIntakeContext } from '../../lib/api';

interface HeroProps {
  onAnalyse: (url: string, context?: AuditIntakeContext) => void;
  loading: boolean;
  errorMessage: string | null;
  /** Skip the "Free AI Website Growth Audit" H1/intro — used when the embedding page already
   *  has its own on-page H1 (e.g. a dedicated tool landing page), to avoid duplicate H1s. */
  compact?: boolean;
}

export function Hero({ onAnalyse, loading, errorMessage, compact = false }: HeroProps) {
  const [url, setUrl] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    onAnalyse(url.trim(), { businessName: businessName.trim(), businessType: businessType.trim(), location: location.trim() });
  }

  return (
    <section id="top" className={`relative scroll-mt-24 px-6 ${compact ? 'py-4' : 'pt-36 pb-28 sm:pt-48 sm:pb-40'}`}>
      <div className="mx-auto max-w-4xl text-center">
        {!compact && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="glass mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-brand-700 dark:text-brand-200"
            >
              <Sparkles className="size-4" />
              Website Audit &amp; Monitoring
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[2.75rem] leading-[1.05] font-extrabold tracking-tight text-ink sm:text-7xl dark:text-white"
            >
              Know When Your
              <br />
              <span className="bg-[linear-gradient(120deg,#3b82f6,#4b7cff_45%,#00c48c)] bg-clip-text text-transparent">
                Website Needs Attention
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate sm:text-xl"
            >
              Scan your website for SEO, performance, accessibility, conversion and local search
              issues — then keep monitoring it automatically so you know when something changes.
            </motion.p>
          </>
        )}

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={handleSubmit}
          className={`glass gradient-border gradient-border-brand mx-auto flex max-w-xl flex-col gap-3 rounded-[26px] p-3 sm:flex-row sm:items-center ${compact ? 'mt-0' : 'mt-14'}`}
        >
          <div className="flex flex-1 items-center gap-3 rounded-2xl px-4 py-3.5">
            <Globe className="size-5 shrink-0 text-slate" />
            <input
              type="text"
              inputMode="url"
              placeholder="yourbusiness.co.uk"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent text-base text-ink placeholder:text-slate/70 outline-none dark:text-white"
            />
          </div>
          <Button type="submit" size="lg" loading={loading} icon={<Search className="size-4" />} className="shrink-0">
            {loading ? 'Analysing…' : 'Start Free Audit'}
          </Button>
        </motion.form>

        {!compact && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="mt-3 text-sm text-slate"
          >
            No account required. No credit card.{' '}
            <a href="/login" className="font-semibold text-brand-500 hover:underline">
              Already have an account? Log in
            </a>
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mx-auto mt-3 max-w-xl"
        >
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
            aria-controls="optional-business-details"
            className="mx-auto flex min-h-11 items-center gap-1 px-3 text-xs font-semibold text-slate transition-colors hover:text-ink dark:hover:text-white"
          >
            Add business details (optional)
            <ChevronDown className={`size-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>
          {showDetails && (
            <div id="optional-business-details" className="glass mt-3 grid gap-2 rounded-2xl p-3 sm:grid-cols-3">
              <input
                type="text"
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-slate/70 outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
              />
              <input
                type="text"
                placeholder="Business type (e.g. plumber)"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-slate/70 outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
              />
              <input
                type="text"
                placeholder="Location (e.g. Bristol)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-slate/70 outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
              />
            </div>
          )}
        </motion.div>

        {errorMessage && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm font-medium text-rose-500">
            {errorMessage}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium text-slate"
        >
          <span className="inline-flex items-center gap-2">
            <Zap className="size-4 text-brand-500" /> Results in ~30 seconds
          </span>
          <span className="inline-flex items-center gap-2">
            <ArrowRight className="size-4 text-brand-500" /> Real, data-backed recommendations
          </span>
        </motion.div>
      </div>
    </section>
  );
}
