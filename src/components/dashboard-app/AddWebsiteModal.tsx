import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Globe, Plus } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { addWebsiteWithFirstScan } from '../../lib/monitoring';
import { ApiError } from '../../lib/api';
import type { ScanFrequency } from '../../lib/types';

interface AddWebsiteModalProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  initialUrl?: string;
  defaultFrequency?: ScanFrequency;
  onCreated: (websiteId: string) => void;
}

const FREQUENCIES: { value: ScanFrequency; label: string; desc: string }[] = [
  { value: 'daily', label: 'Daily', desc: 'Scan every day' },
  { value: 'weekly', label: 'Weekly', desc: 'Scan once a week' },
  { value: 'monthly', label: 'Monthly', desc: 'Scan once a month' },
  { value: 'manual', label: 'Manual', desc: 'Only when you click Scan Now' },
];

export function AddWebsiteModal({ open, onClose, uid, initialUrl, defaultFrequency, onCreated }: AddWebsiteModalProps) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [frequency, setFrequency] = useState<ScanFrequency>(defaultFrequency ?? 'weekly');

  useEffect(() => {
    if (open) setFrequency(defaultFrequency ?? 'weekly');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { websiteId } = await addWebsiteWithFirstScan(uid, url.trim(), frequency);
      onCreated(websiteId);
      setUrl('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this website. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-md"
          onClick={submitting ? undefined : onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <GlassCard gradientBorder className="relative bg-white/95 p-8 dark:bg-[#0f0f1e]/95">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="absolute right-5 top-5 text-slate transition-colors hover:text-ink dark:hover:text-white"
              >
                <X className="size-5" />
              </button>

              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#4b7cff)] text-white">
                <Plus className="size-6" />
              </div>
              <h3 className="font-display text-xl font-bold text-ink dark:text-white">Add a website to monitor</h3>
              <p className="mt-1 text-sm text-slate">We'll run a full audit now, then keep scanning on your chosen schedule.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <div className="flex items-center gap-2.5 rounded-2xl border border-ink/10 px-4 py-3 focus-within:border-brand-400 dark:border-white/10">
                  <Globe className="size-4 shrink-0 text-slate" />
                  <input
                    type="text"
                    required
                    placeholder="yourbusiness.co.uk"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={submitting}
                    className="w-full bg-transparent text-sm text-ink placeholder:text-slate/70 outline-none dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFrequency(f.value)}
                      disabled={submitting}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                        frequency === f.value
                          ? 'border-brand-400 bg-brand-500/10'
                          : 'border-ink/10 hover:border-brand-300 dark:border-white/10'
                      }`}
                    >
                      <div className="text-sm font-semibold text-ink dark:text-white">{f.label}</div>
                      <div className="text-xs text-slate">{f.desc}</div>
                    </button>
                  ))}
                </div>

                {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

                <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
                  {submitting ? 'Running first scan…' : 'Add Website'}
                </Button>
              </form>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
