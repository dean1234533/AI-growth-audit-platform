import { motion } from 'framer-motion';
import { CheckCircle2, CalendarCheck, FileText, Briefcase } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import type { Recommendation } from '../../lib/types';

interface CtaSectionProps {
  recommendations: Recommendation[];
  consultationUrl?: string;
  quoteUrl?: string;
  portfolioUrl?: string;
}

const DEFAULT_URL = 'https://dean-da-dev.co.uk';
const CONSULTATION_URL = 'https://www.dean-da-dev.co.uk/DiscoveryCall';

export function CtaSection({
  recommendations,
  consultationUrl = CONSULTATION_URL,
  quoteUrl = DEFAULT_URL,
  portfolioUrl = DEFAULT_URL,
}: CtaSectionProps) {
  const topIssues = recommendations.slice(0, 6);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6 }}>
      <GlassCard className="relative overflow-hidden p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gradient-to-br from-brand-500/30 to-accent-500/30 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl dark:text-white">We Can Fix Everything For You</h2>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Every issue in this report is something our team fixes every day. Here's what we'd tackle first:
          </p>

          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {topIssues.map((issue) => (
              <li key={issue.id} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-500" />
                {issue.title}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" icon={<CalendarCheck className="size-4" />} onClick={() => window.open(consultationUrl, '_blank')}>
              Book a Free Consultation
            </Button>
            <Button size="lg" variant="secondary" icon={<FileText className="size-4" />} onClick={() => window.open(quoteUrl, '_blank')}>
              Request a Quote
            </Button>
            <Button size="lg" variant="ghost" icon={<Briefcase className="size-4" />} onClick={() => window.open(portfolioUrl, '_blank')}>
              View Portfolio
            </Button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
