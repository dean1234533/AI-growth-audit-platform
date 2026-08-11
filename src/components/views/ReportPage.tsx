import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Globe, AlertTriangle, Activity, CalendarClock, MessageCircle, ShieldCheck } from 'lucide-react';
import { WebsiteHealthHero } from '../dashboard/WebsiteHealthHero';
import { CategoryCard } from '../dashboard/CategoryCard';
import { RadarScoreChart, SeverityBarChart, PerformanceBreakdownChart } from '../dashboard/Charts';
import { GrowthEstimateSection } from '../dashboard/GrowthEstimate';
import { GrowthOpportunities } from '../dashboard/GrowthOpportunities';
import { HowICanHelp } from '../dashboard/HowICanHelp';
import { LeadCaptureModal } from '../leadgen/LeadCaptureModal';
import { EnquiryModal } from '../leadgen/EnquiryModal';
import { Button } from '../ui/Button';
import { FloatingBackground } from '../landing/FloatingBackground';
import { generateAuditPdf } from '../../lib/pdf';
import { markPwaInstallEligible } from '../pwa/InstallBanner';
import { buildServiceRecommendations } from '../../lib/serviceRecommendations';
import { CONSULTATION_URL } from '../../lib/seo/site';
import type { AuditResult, Lead } from '../../lib/types';

interface ReportPageProps {
  audit: AuditResult;
  onBack: () => void;
}

export function ReportPage({ audit, onBack }: ReportPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiryPrefill, setEnquiryPrefill] = useState<string | undefined>(undefined);

  function handleGetFixed(serviceTitle?: string) {
    setEnquiryPrefill(serviceTitle);
    setEnquiryOpen(true);
  }

  useEffect(() => {
    markPwaInstallEligible();
  }, []);

  // meta.partial can come from a PageSpeed Insights warning (meta.warnings), a browser-rendering
  // fallback (meta.warnings stays empty — see runFullAudit.ts), or both; show whichever applies
  // rather than assuming warnings is always populated.
  const partialReasons = [
    ...audit.meta.warnings,
    ...(audit.meta.partial && !audit.meta.scanQuality?.jsRenderingUsed
      ? ['Some browser-based checks could not be completed. Results may be less comprehensive than a full browser-rendered scan.']
      : []),
  ];

  function handleLeadSuccess(lead: Lead) {
    generateAuditPdf(audit, lead);
    setModalOpen(false);
    setDownloaded(true);
  }

  return (
    <div className="relative px-6 py-16 sm:py-24">
      <FloatingBackground />
      <div className="relative mx-auto max-w-6xl space-y-20 sm:space-y-28">
        <div>
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate transition-colors hover:text-ink dark:hover:text-white"
            >
              <ArrowLeft className="size-4" /> Analyse another site
            </button>
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-slate">
              <Globe className="size-4 text-brand-500" />
              {audit.url}
            </div>
          </div>

          {audit.meta.partial && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass mb-10 flex items-start gap-3 rounded-2xl px-5 py-4 text-sm text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong className="font-semibold">Partial scan.</strong> {partialReasons.join(' ')}
              </span>
            </motion.div>
          )}

          <WebsiteHealthHero
            score={audit.overallScore}
            categories={audit.categories}
            recommendationCount={audit.recommendations.length}
            scannedAt={audit.scannedAt}
            scanQuality={audit.meta.scanQuality}
            auditQuality={audit.meta.auditQuality}
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 overflow-hidden rounded-3xl border border-brand-400/25 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(0,196,140,0.08))] p-6 shadow-[0_24px_70px_-40px_rgba(59,130,246,0.65)] sm:p-8"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
                  <ShieldCheck className="size-4" /> Free, no-pressure advice
                </span>
                <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl dark:text-white">
                  Want a clear plan for fixing your results?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate sm:text-base">
                  Book a free 15-minute website review with Dean. We’ll look at your audit together and identify the quickest wins for getting more enquiries.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                <Button
                  size="lg"
                  icon={<CalendarClock className="size-4" />}
                  onClick={() => window.open(CONSULTATION_URL, '_blank', 'noopener,noreferrer')}
                  className="w-full sm:w-auto"
                >
                  Book My Free Website Review
                </Button>
                <Button size="lg" variant="secondary" icon={<MessageCircle className="size-4" />} onClick={() => handleGetFixed()} className="w-full sm:w-auto">
                  Contact Me Instead
                </Button>
              </div>
            </div>
            <p className="mt-4 text-xs font-medium text-slate">No obligation · Your audit is already complete · Choose a time that suits you</p>
          </motion.div>

          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button size="md" variant="secondary" onClick={() => setModalOpen(true)} disabled={downloaded} success={downloaded}>
              {downloaded ? (
                <>
                  <CheckCircle2 className="size-4" /> Report downloaded
                </>
              ) : (
                'Unlock My Professional Report'
              )}
            </Button>
            <Button
              size="md"
              variant="ghost"
              icon={<Activity className="size-4" />}
              onClick={() => {
                window.location.href = `/login?url=${encodeURIComponent(audit.url)}`;
              }}
            >
              Monitor This Site Automatically
            </Button>
          </div>
        </div>

        <section>
          <SectionHeading eyebrow="Category breakdown" title="Where you stand" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {audit.categories.map((category, i) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <CategoryCard category={category} recommendations={audit.recommendations.filter((r) => r.category === category.id)} />
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Visual analysis" title="The full picture" />
          <div className="grid gap-6 lg:grid-cols-3">
            <RadarScoreChart categories={audit.categories} />
            <SeverityBarChart recommendations={audit.recommendations} />
            <PerformanceBreakdownChart categories={audit.categories} />
          </div>
        </section>

        <GrowthEstimateSection estimate={audit.growthEstimate} />

        <GrowthOpportunities recommendations={audit.recommendations} />

        <HowICanHelp audit={audit} onGetFixed={handleGetFixed} />
      </div>

      <LeadCaptureModal open={modalOpen} onClose={() => setModalOpen(false)} audit={audit} onSuccess={handleLeadSuccess} />
      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        audit={audit}
        initialHelpWith={enquiryPrefill}
        recommendedServices={buildServiceRecommendations(audit).map((s) => s.title)}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a12]/95 p-3 shadow-2xl backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <Button
            size="md"
            icon={<CalendarClock className="size-4" />}
            onClick={() => window.open(CONSULTATION_URL, '_blank', 'noopener,noreferrer')}
            className="flex-1"
          >
            Book Free Review
          </Button>
          <Button size="md" variant="secondary" onClick={() => handleGetFixed()} aria-label="Contact Dean">
            <MessageCircle className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }} className="mb-8">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl dark:text-white">{title}</h2>
    </motion.div>
  );
}
