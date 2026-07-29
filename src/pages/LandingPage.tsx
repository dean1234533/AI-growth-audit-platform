import { FloatingBackground } from '../components/landing/FloatingBackground';
import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';

interface LandingPageProps {
  onAnalyse: (url: string) => void;
  loading: boolean;
  errorMessage: string | null;
}

export function LandingPage({ onAnalyse, loading, errorMessage }: LandingPageProps) {
  return (
    <div className="relative">
      <FloatingBackground />
      <Hero onAnalyse={onAnalyse} loading={loading} errorMessage={errorMessage} />
      <HowItWorks />
    </div>
  );
}
