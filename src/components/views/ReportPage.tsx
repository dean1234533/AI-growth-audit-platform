import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Globe, AppWindow, AlertTriangle, Activity, CalendarClock, ShieldCheck } from 'lucide-react';
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
import { trackFunnelEvent } from '../../lib/api';
import type { AttributionContext } from '../../lib/attribution';
import type { AuditResult, Lead } from '../../lib/types';

interface ReportPageProps {
  audit: AuditResult;
  onBack: () => void;
  attribution?: AttributionContext | null;
}

export function ReportPage({ audit, onBack, attribution }: ReportPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiryPrefill, setEnquiryPrefill] = useState<string | undefined>(undefined);

  function handleGetFixed(serviceTitle?: string) {
    void trackFunnelEvent('enquiry_opened', attribution, { website: audit.url }).catch(() => undefined);
    setEnquiryPrefill(serviceTitle);
    setEnquiryOpen(true);
  }

  function handleBook() {
    void trackFunnelEvent('booking_clicked', attribution, { website: audit.url }).catch(() => undefined);
    window.open(CONSULTATION_URL, '_blank', 'noopener,noreferrer');
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
    <div className="relative px-5 py-10 sm:px-6 sm:py-16">
      <FloatingBackground />
      <div className="relative mx-auto max-w-7xl space-y-16 sm:space-y-24">
        <div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-5 text-xs font-semibold dark:border-white/10">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-slate transition-colors hover:text-ink dark:hover:text-white"
            >
              <ArrowLeft className="size-4" /> Analyse another site
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 text-slate">
                <Globe className="size-4 text-brand-500" />
                {audit.url}
              </div>
              {audit.meta.siteType && (
                <div
                  className="inline-flex items-center gap-1.5 border-l border-ink/30 pl-3 text-slate dark:border-white/30"
                  title={audit.meta.siteTypeReason}
                >
                  <AppWindow className="size-3.5 text-brand-500" />
                  {audit.meta.siteType === 'app' ? 'App' : 'Website'}
                </div>
              )}
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

          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button size="md" variant="secondary" onClick={() => {
              void trackFunnelEvent('report_unlocked', attribution, { website: audit.url }).catch(() => undefined);
              setModalOpen(true);
            }} disabled={downloaded} success={downloaded}>
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
                void trackFunnelEvent('monitor_clicked', attribution, { website: audit.url }).catch(() => undefined);
                window.location.href = `/login?url=${encodeURIComponent(audit.url)}`;
              }}
            >
              Monitor This Site Automatically
            </Button>
          </div>
        </div>

        <section>
          <SectionHeading eyebrow="Highest priority" title="Fix these first" />
          <GrowthOpportunities recommendations={audit.recommendations} />
        </section>

        <section>
          <SectionHeading eyebrow="Category breakdown" title="How each area performed" />
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

        <GrowthEstimateSection estimate={audit.growthEstimate} />

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="surface grid overflow-hidden rounded-2xl lg:grid-cols-[1fr_auto]"
        >
          <div className="p-6 sm:p-8">
            <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] font-black uppercase tracking-[0.1em] text-brand-500"><ShieldCheck className="size-4" /> Independent second opinion</span>
            <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-ink sm:text-3xl dark:text-white">Talk through the inspection with Dean.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate">A free 15-minute review to decide what is worth fixing now, what can wait, and what will make the biggest commercial difference.</p>
          </div>
          <div className="flex items-center border-t border-ink/10 p-6 lg:border-l lg:border-t-0 sm:p-8 dark:border-white/10">
            <Button size="lg" icon={<CalendarClock className="size-4" />} onClick={handleBook}>Book the free review</Button>
          </div>
        </motion.section>

        <HowICanHelp audit={audit} onGetFixed={handleGetFixed} onBook={handleBook} />

        <section>
          <SectionHeading eyebrow="Visual analysis" title="The full picture" />
          <div className="grid gap-6 lg:grid-cols-3">
            <RadarScoreChart categories={audit.categories} />
            <SeverityBarChart recommendations={audit.recommendations} />
            <PerformanceBreakdownChart categories={audit.categories} />
          </div>
        </section>
      </div>

      <LeadCaptureModal open={modalOpen} onClose={() => setModalOpen(false)} audit={audit} onSuccess={handleLeadSuccess} attribution={attribution} />
      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        audit={audit}
        initialHelpWith={enquiryPrefill}
        recommendedServices={buildServiceRecommendations(audit).map((s) => s.title)}
        attribution={attribution}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-brand-400 bg-[#0a0a12]/95 p-3 shadow-2xl sm:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <Button
            size="md"
            icon={<CalendarClock className="size-4" />}
            onClick={handleBook}
            className="flex-1"
          >
            Book Free Review
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5 }} className="mb-8">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl dark:text-white">{title}</h2>
    </motion.div>
  );
}
