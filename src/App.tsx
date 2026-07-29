import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LandingPage } from './pages/LandingPage';
import { ScanningState } from './pages/ScanningState';
import { ReportPage } from './pages/ReportPage';
import { runAudit, ApiError } from './lib/api';
import type { AuditResult } from './lib/types';

type View = 'landing' | 'scanning' | 'report';

export default function App() {
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

  return (
    <div className="min-h-screen bg-canvas text-ink dark:bg-[#0a0a12] dark:text-white">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            <LandingPage onAnalyse={handleAnalyse} loading={false} errorMessage={error} />
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
