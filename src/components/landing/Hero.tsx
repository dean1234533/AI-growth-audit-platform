import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Globe, Sparkles, ArrowRight, ShieldCheck, Zap, Search } from 'lucide-react';
import { Button } from '../ui/Button';

interface HeroProps {
  onAnalyse: (url: string) => void;
  loading: boolean;
  errorMessage: string | null;
}

export function Hero({ onAnalyse, loading, errorMessage }: HeroProps) {
  const [url, setUrl] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    onAnalyse(url.trim());
  }

  return (
    <section className="relative px-6 pt-28 pb-20 sm:pt-36 sm:pb-28">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-brand-700 dark:text-brand-200"
        >
          <Sparkles className="size-4" />
          Free AI-Powered Website Analysis
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl dark:text-white"
        >
          Free AI Website{' '}
          <span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
            Growth Audit
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl dark:text-slate-300"
        >
          Find out exactly what's stopping your website from getting more enquiries, customers and
          Google traffic — in under 30 seconds.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onSubmit={handleSubmit}
          className="glass mx-auto mt-10 flex max-w-xl flex-col gap-3 rounded-2xl p-2.5 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-2.5 rounded-xl px-4 py-3">
            <Globe className="size-5 shrink-0 text-slate-400" />
            <input
              type="text"
              inputMode="url"
              placeholder="yourbusiness.co.uk"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none dark:text-white"
            />
          </div>
          <Button type="submit" size="lg" loading={loading} icon={<Search className="size-4" />} className="shrink-0">
            {loading ? 'Analysing…' : 'Analyse My Website'}
          </Button>
        </motion.form>

        {errorMessage && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm font-medium text-red-500">
            {errorMessage}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500 dark:text-slate-400"
        >
          <span className="inline-flex items-center gap-1.5">
            <Zap className="size-4 text-brand-500" /> Results in ~30 seconds
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-brand-500" /> No obligation, no spam
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ArrowRight className="size-4 text-brand-500" /> Real, data-backed recommendations
          </span>
        </motion.div>
      </div>
    </section>
  );
}
