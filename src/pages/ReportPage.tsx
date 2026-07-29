import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Globe } from 'lucide-react';
import { ScoreCircle } from '../components/dashboard/ScoreCircle';
import { CategoryCard } from '../components/dashboard/CategoryCard';
import { RadarScoreChart, SeverityBarChart, PerformanceBreakdownChart } from '../components/dashboard/Charts';
import { GrowthEstimateSection } from '../components/dashboard/GrowthEstimate';
import { CtaSection } from '../components/dashboard/CtaSection';
import { LeadCaptureModal } from '../components/leadgen/LeadCaptureModal';
import { Button } from '../components/ui/Button';
import { FloatingBackground } from '../components/landing/FloatingBackground';
import { generateAuditPdf } from '../lib/pdf';
import type { AuditResult, Lead } from '../lib/types';

interface ReportPageProps {
  audit: AuditResult;
  onBack: () => void;
}

export function ReportPage({ audit, onBack }: ReportPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  function handleLeadSuccess(lead: Lead) {
    generateAuditPdf(audit, lead);
    setModalOpen(false);
    setDownloaded(true);
  }

  return (
    <div className="relative px-6 py-12 sm:py-16">
      <FloatingBackground />
      <div className="relative mx-auto max-w-6xl space-y-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white">
            <ArrowLeft className="size-4" /> Analyse another site
          </button>
          <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Globe className="size-4" />
            {audit.url}
          </div>
        </div>

        {audit.meta.partial && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-300">
            This audit is based on partial data: {audit.meta.warnings.join(' ')}
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
          <ScoreCircle score={audit.overallScore} />
          <div className="max-w-sm text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Website Growth Audit</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              We found {audit.recommendations.length} opportunit{audit.recommendations.length === 1 ? 'y' : 'ies'} to improve
              your enquiries, visibility and conversion rate.
            </p>
            <Button size="lg" className="mt-5" onClick={() => setModalOpen(true)} disabled={downloaded}>
              {downloaded ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4" /> Report downloaded
                </span>
              ) : (
                'Download Full PDF Report'
              )}
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audit.categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              recommendations={audit.recommendations.filter((r) => r.category === category.id)}
            />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <RadarScoreChart categories={audit.categories} />
          <SeverityBarChart recommendations={audit.recommendations} />
          <PerformanceBreakdownChart categories={audit.categories} />
        </div>

        <GrowthEstimateSection estimate={audit.growthEstimate} />

        <CtaSection recommendations={audit.recommendations} />
      </div>

      <LeadCaptureModal open={modalOpen} onClose={() => setModalOpen(false)} audit={audit} onSuccess={handleLeadSuccess} />
    </div>
  );
}
