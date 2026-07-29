import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Download, User, Mail, Building2, Globe } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <GlassCard className="relative bg-white/90 p-8 dark:bg-slate-900/90">
              <button type="button" onClick={onClose} className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="size-5" />
              </button>

              <div className="mb-2 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <Download className="size-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Get your full PDF report</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Enter your details to download the complete, branded audit report.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <Field icon={User} placeholder="Your name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                <Field icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                <Field icon={Building2} placeholder="Business name" value={form.business} onChange={(v) => setForm((f) => ({ ...f, business: v }))} />
                <Field icon={Globe} placeholder="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />

                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
                  Download My Report
                </Button>
              </form>
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
    <div className="flex items-center gap-2.5 rounded-xl border border-black/10 px-4 py-2.5 focus-within:border-brand-400 dark:border-white/10">
      <Icon className="size-4 shrink-0 text-slate-400" />
      <input
        required
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-white"
      />
    </div>
  );
}
