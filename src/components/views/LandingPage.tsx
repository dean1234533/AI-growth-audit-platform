import { FloatingBackground } from '../landing/FloatingBackground';
import { Hero } from '../landing/Hero';
import { HowItWorks } from '../landing/HowItWorks';
import { HomepagePricing } from '../landing/HomepagePricing';
import type { AuditIntakeContext } from '../../lib/api';

interface LandingPageProps {
  onAnalyse: (url: string, context?: AuditIntakeContext) => void;
  loading: boolean;
  errorMessage: string | null;
  /** Used when embedded on a page that already has its own hero/H1 and marketing copy
   *  (e.g. a dedicated tool landing page) — renders just the input form, no duplicate chrome. */
  compact?: boolean;
  initialUrl?: string;
}

export function LandingPage({ onAnalyse, loading, errorMessage, compact = false, initialUrl }: LandingPageProps) {
  if (compact) {
    return <Hero onAnalyse={onAnalyse} loading={loading} errorMessage={errorMessage} compact initialUrl={initialUrl} />;
  }

  return (
    <div className="premium-public relative">
      <FloatingBackground />
      <Hero onAnalyse={onAnalyse} loading={loading} errorMessage={errorMessage} initialUrl={initialUrl} />
      <HowItWorks />
      <HomepagePricing />
    </div>
  );
}
