import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from './ui/motion-lite';
import { LandingPage } from './views/LandingPage';
import { ScanningState } from './views/ScanningState';
import { runAudit, trackFunnelEvent, ApiError, type AuditIntakeContext } from '../lib/api';
import { decodeAttribution } from '../lib/attribution';
import type { AuditResult } from '../lib/types';

type View = 'landing' | 'scanning' | 'report';

const ReportPage = lazy(() => import('./views/ReportPage').then((module) => ({ default: module.ReportPage })));

interface AuditToolProps {
  /** Used on pages that already have their own hero/H1 (dedicated tool landing pages) —
   *  renders just the input form instead of the full marketing hero + "how it works" section. */
  compact?: boolean;
}

export default function AuditTool({ compact = false }: AuditToolProps) {
  const [view, setView] = useState<View>('landing');
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attribution = useMemo(() => typeof window === 'undefined' ? null : decodeAttribution(window.location.search), []);

  useEffect(() => {
    if (attribution) void trackFunnelEvent('landing_view', attribution).catch(() => undefined);
  }, [attribution]);

  async function handleAnalyse(url: string, context?: AuditIntakeContext) {
    setError(null);
    setView('scanning');
    void trackFunnelEvent('audit_started', attribution, { website: url }).catch(() => undefined);
    try {
      const result = await runAudit(url, context);
      setAudit(result);
      setView('report');
      void trackFunnelEvent('audit_completed', attribution, { website: result.url, score: result.overallScore }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setView('landing');
    }
  }

  const wrapperClass = view === 'landing' && compact ? '' : 'min-h-screen bg-canvas text-ink dark:bg-[#0a0a12] dark:text-white';

  return (
    <div className={wrapperClass}>
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <LandingPage onAnalyse={handleAnalyse} loading={false} errorMessage={error} compact={compact} initialUrl={attribution?.website} />
          </motion.div>
        )}
        {view === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <ScanningState />
          </motion.div>
        )}
        {view === 'report' && audit && (
          <Suspense fallback={<ScanningState />}>
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
              <ReportPage audit={audit} onBack={() => setView('landing')} attribution={attribution} />
            </motion.div>
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
