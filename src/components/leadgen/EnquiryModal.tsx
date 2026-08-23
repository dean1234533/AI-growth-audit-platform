import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, User, Mail, MessageSquare, CheckCircle2, Send } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { submitEnquiry, ApiError } from '../../lib/api';
import type { AuditResult, EnquiryLead } from '../../lib/types';
import type { AttributionContext } from '../../lib/attribution';

interface EnquiryModalProps {
  open: boolean;
  onClose: () => void;
  audit: AuditResult;
  /** Prefills "what would you like help with" — e.g. the service the user clicked from. */
  initialHelpWith?: string;
  recommendedServices?: string[];
  attribution?: AttributionContext | null;
}

const CONTACT_OPTIONS: { id: EnquiryLead['preferredContact']; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'either', label: 'Either' },
];

const EMPTY: EnquiryLead = { name: '', email: '', business: '', website: '', helpWith: '', preferredContact: 'email', message: '' };

function businessFromWebsite(website: string): string {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
  } catch {
    return website || 'Website audit visitor';
  }
}

export function EnquiryModal({ open, onClose, audit, initialHelpWith, recommendedServices = [], attribution }: EnquiryModalProps) {
  const [form, setForm] = useState<EnquiryLead>({ ...EMPTY, website: audit.url, business: businessFromWebsite(audit.url) });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, helpWith: initialHelpWith ?? f.helpWith }));
  }, [open, initialHelpWith]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitEnquiry(
        form,
        { url: audit.url, overallScore: audit.overallScore, scannedAt: audit.scannedAt, categories: audit.categories, recommendations: audit.recommendations },
        recommendedServices,
        attribution,
      );
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setForm({ ...EMPTY, website: audit.url, business: businessFromWebsite(audit.url) });
    }, 300);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <GlassCard gradientBorder className="relative max-h-[90vh] overflow-y-auto bg-white/95 p-8 dark:bg-[#0f0f1e]/95">
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-5 top-5 z-20 flex size-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="size-5" />
              </button>

              {sent ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-mint-500/10 text-mint-600">
                    <CheckCircle2 className="size-7" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-ink dark:text-white">Thanks — got it.</h3>
                  <p className="max-w-sm text-sm text-slate">
                    I'll take a look at your audit and get back to you shortly with next steps.
                  </p>
                  <Button variant="secondary" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Get These Fixed</span>
                  <h3 className="mt-2 font-display text-xl font-bold text-ink dark:text-white">Ask Dean about your results</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate">
                    Your website and audit results are attached automatically, so you only need to leave your contact details.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                    <Field icon={User} placeholder="Your name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <Field icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                    <Field
                      icon={MessageSquare}
                      placeholder="What would you like help with?"
                      value={form.helpWith}
                      onChange={(v) => setForm((f) => ({ ...f, helpWith: v }))}
                    />

                    <textarea
                      placeholder="Anything else you'd like to add? (optional)"
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      rows={3}
                      className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink placeholder:text-slate/70 outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
                    />

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate">Preferred contact method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {CONTACT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, preferredContact: opt.id }))}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                              form.preferredContact === opt.id
                                ? 'border-brand-400 bg-brand-500/10 text-ink dark:text-white'
                                : 'border-ink/10 text-slate hover:border-ink/20 dark:border-white/10'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

                    <Button type="submit" size="lg" loading={submitting} icon={<Send className="size-4" />} className="mt-2 w-full">
                      Send My Details
                    </Button>
                    <p className="text-center text-[11px] text-slate">No spam — just a reply about your website.</p>
                  </form>
                </>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface FieldProps {
  icon: typeof User;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}

function Field({ icon: Icon, placeholder, value, onChange, type = 'text' }: FieldProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-ink/10 px-4 py-3 transition-colors focus-within:border-brand-400 dark:border-white/10">
      <Icon className="size-4 shrink-0 text-slate" />
      <input
        required
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-ink placeholder:text-slate/70 outline-none dark:text-white"
      />
    </div>
  );
}
