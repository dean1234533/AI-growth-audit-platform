import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Globe, AlertTriangle, Activity } from 'lucide-react';
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

          <div className="mt-8 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button size="lg" onClick={() => setModalOpen(true)} disabled={downloaded} success={downloaded}>
              {downloaded ? (
                <>
                  <CheckCircle2 className="size-4" /> Report downloaded
                </>
              ) : (
                'Unlock My Professional Report'
              )}
            </Button>
            <Button
              size="lg"
              variant="secondary"
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
