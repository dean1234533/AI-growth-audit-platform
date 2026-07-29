import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LandingPage } from './views/LandingPage';
import { ScanningState } from './views/ScanningState';
import { ReportPage } from './views/ReportPage';
import { runAudit, ApiError } from '../lib/api';
import type { AuditResult } from '../lib/types';

type View = 'landing' | 'scanning' | 'report';

interface AuditToolProps {
  /** Used on pages that already have their own hero/H1 (dedicated tool landing pages) —
   *  renders just the input form instead of the full marketing hero + "how it works" section. */
  compact?: boolean;
}

export default function AuditTool({ compact = false }: AuditToolProps) {
  const [view, setView] = useState<View>('landing');
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyse(url: string) {
    setError(null);
    setView('scanning');
    try {
      const result = await runAudit(url);
      setAudit(result);
      setView('report');
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
            <LandingPage onAnalyse={handleAnalyse} loading={false} errorMessage={error} compact={compact} />
          </motion.div>
        )}
        {view === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <ScanningState />
          </motion.div>
        )}
        {view === 'report' && audit && (
          <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <ReportPage audit={audit} onBack={() => setView('landing')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
