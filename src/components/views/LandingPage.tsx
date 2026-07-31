import { FloatingBackground } from '../landing/FloatingBackground';
import { Hero } from '../landing/Hero';
import { HowItWorks } from '../landing/HowItWorks';
import type { AuditIntakeContext } from '../../lib/api';

interface LandingPageProps {
  onAnalyse: (url: string, context?: AuditIntakeContext) => void;
  loading: boolean;
  errorMessage: string | null;
  /** Used when embedded on a page that already has its own hero/H1 and marketing copy
   *  (e.g. a dedicated tool landing page) — renders just the input form, no duplicate chrome. */
  compact?: boolean;
}

export function LandingPage({ onAnalyse, loading, errorMessage, compact = false }: LandingPageProps) {
  if (compact) {
    return <Hero onAnalyse={onAnalyse} loading={loading} errorMessage={errorMessage} compact />;
  }

  return (
    <div className="relative">
      <FloatingBackground />
      <Hero onAnalyse={onAnalyse} loading={loading} errorMessage={errorMessage} />
      <HowItWorks />
    </div>
  );
}
