import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Lock, User, Mail, Building2, Globe, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { ScoreCircle } from '../dashboard/ScoreCircle';
import { scoreBand } from '../../lib/scoreBand';
import { submitLead, ApiError } from '../../lib/api';
import type { AuditResult, Lead } from '../../lib/types';

interface LeadCaptureModalProps {
  open: boolean;
  onClose: () => void;
  audit: AuditResult;
  onSuccess: (lead: Lead) => void;
}

export function LeadCaptureModal({ open, onClose, audit, onSuccess }: LeadCaptureModalProps) {
  const [form, setForm] = useState<Lead>({ name: '', email: '', business: '', website: audit.url });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { label } = scoreBand(audit.overallScore);
  const strengths = [...audit.categories].filter((c) => c.checks.length > 0).sort((a, b) => b.score - a.score).slice(0, 2);
  const critical = audit.recommendations.filter((r) => r.severity === 'critical' || r.severity === 'high').slice(0, 3);
  const enquiries = audit.growthEstimate.additionalEnquiriesPerMonth;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitLead(form, { url: audit.url, overallScore: audit.overallScore, scannedAt: audit.scannedAt });
      onSuccess(form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
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
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl"
          >
            <GlassCard gradientBorder className="relative max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-[#0f0f1e]/95">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 z-20 flex size-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="size-5" />
              </button>

              <div className="grid sm:grid-cols-[1.1fr_1fr]">
                {/* Summary panel */}
                <div className="relative overflow-hidden border-b border-ink/[0.06] p-8 sm:border-b-0 sm:border-r sm:p-10 dark:border-white/10">
                  <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-brand-400/20 blur-[80px]" />

                  <span className="relative text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Your report preview</span>
                  <h3 className="relative mt-3 font-display text-2xl font-extrabold tracking-tight text-ink dark:text-white">
                    {form.website || audit.url}
                  </h3>

                  <div className="relative mt-8 flex items-center gap-5">
                    <ScoreCircle score={audit.overallScore} size={104} strokeWidth={8} />
                    <div>
                      <div className="text-sm font-medium text-slate">Website Health</div>
                      <div className="font-display text-lg font-bold text-ink dark:text-white">{label}</div>
                    </div>
                  </div>

                  {strengths.length > 0 && (
                    <div className="relative mt-7">
                      <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate">Strengths</div>
                      <div className="space-y-2">
                        {strengths.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                            <CheckCircle2 className="size-4 shrink-0 text-mint-500" />
                            {s.label} — {s.score}/100
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {critical.length > 0 && (
                    <div className="relative mt-6">
                      <div className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate">Critical issues</div>
                      <div className="space-y-2">
                        {critical.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-sm font-medium text-ink dark:text-slate-100">
                            <AlertTriangle className="size-4 shrink-0 text-rose-500" />
                            {c.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="glass relative mt-7 flex items-center gap-3 rounded-2xl px-4 py-3.5">
                    <TrendingUp className="size-5 shrink-0 text-mint-500" />
                    <div className="text-sm font-medium text-ink dark:text-slate-100">
                      Est. <strong className="font-bold">+{enquiries[0]}-{enquiries[1]}</strong> enquiries/month if fixed
                    </div>
                  </div>
                </div>

                {/* Form panel */}
                <div className="p-8 sm:p-10">
                  <div className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white shadow-[0_16px_32px_-10px_rgba(108,99,255,0.55)]">
                    <Lock className="size-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-ink dark:text-white">Unlock the full report</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate">
                    Every recommendation, priority order, and estimated impact — delivered as a branded PDF you can keep.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-7 space-y-3">
                    <Field icon={User} placeholder="Your name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <Field icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                    <Field icon={Building2} placeholder="Business name" value={form.business} onChange={(v) => setForm((f) => ({ ...f, business: v }))} />
                    <Field icon={Globe} placeholder="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />

                    {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

                    <Button type="submit" size="lg" loading={submitting} className="mt-3 w-full">
                      Unlock My Professional Report
                    </Button>
                    <p className="text-center text-[11px] text-slate">No spam. Your details are only used to send your report.</p>
                  </form>
                </div>
              </div>
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
