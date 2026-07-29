import { motion } from 'framer-motion';
import { CheckCircle2, CalendarCheck, FileText, Briefcase, Sparkles } from 'lucide-react';
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
const PORTFOLIO_URL = 'https://www.dean-da-dev.co.uk/portfolio';

export function CtaSection({
  recommendations,
  consultationUrl = CONSULTATION_URL,
  quoteUrl = DEFAULT_URL,
  portfolioUrl = PORTFOLIO_URL,
}: CtaSectionProps) {
  const topIssues = recommendations.slice(0, 6);

  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
      <GlassCard gradientBorder className="relative overflow-hidden p-10 sm:p-16">
        <div className="animate-glow-pulse pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-[radial-gradient(circle,#6c63ff44,transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-72 rounded-full bg-mint-400/15 blur-[90px]" />

        <div className="relative">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-brand-500">
            <Sparkles className="size-3.5" /> Done for you
          </span>

          <h2 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl dark:text-white">
            We Can Fix Everything For You
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">
            Every issue in this report is something our team fixes every day. Here's what we'd tackle first:
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {topIssues.map((issue, i) => (
              <motion.li
                key={issue.id}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="glass flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium text-ink dark:text-slate-100"
              >
                <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-mint-500" />
                {issue.title}
              </motion.li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-4">
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
