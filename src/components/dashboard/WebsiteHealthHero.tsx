import { Eye, Gauge, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { scoreBand } from '../../lib/scoreBand';
import { isCategoryScored } from '../../lib/scoring';
import type { CategoryScore, ScanQuality } from '../../lib/types';

interface WebsiteHealthHeroProps {
  score: number;
  categories: CategoryScore[];
  recommendationCount: number;
  scannedAt: string;
  scoreDelta?: number | null;
  scanQuality?: ScanQuality;
  auditQuality?: 'FULL' | 'PARTIAL' | 'STATIC_FALLBACK';
  siteType?: 'website' | 'app';
}

const AUDIT_QUALITY_COPY = {
  FULL: 'Full audit',
  PARTIAL: 'Partial audit',
  STATIC_FALLBACK: 'Static fallback',
} as const;

export function WebsiteHealthHero({ score, categories, recommendationCount, scannedAt, scoreDelta, scanQuality, auditQuality, siteType }: WebsiteHealthHeroProps) {
  const band = scoreBand(score);
  const scoredCategories = categories.filter(isCategoryScored);
  const sorted = [...scoredCategories].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const target = siteType === 'app' ? 'app' : 'website';

  return (
    <section className="report-summary">
      <div className="report-score">
        <span>Overall health</span>
        <strong>{score}</strong>
        <div style={{ color: band.color }}>{band.label}</div>
        {scoreDelta !== undefined && scoreDelta !== null && (
          <small className={scoreDelta > 0 ? 'positive' : scoreDelta < 0 ? 'negative' : ''}>
            {scoreDelta > 0 ? <TrendingUp /> : scoreDelta < 0 ? <TrendingDown /> : <Minus />}
            {scoreDelta === 0 ? 'No change' : `${scoreDelta > 0 ? '+' : ''}${scoreDelta} since last scan`}
          </small>
        )}
      </div>

      <div className="report-verdict">
        <span>Audit summary</span>
        <h1>{recommendationCount === 0 ? `Your ${target} is in strong shape.` : `${recommendationCount} opportunities to improve your ${target}.`}</h1>
        <p>The findings below are ordered to show what deserves attention first, followed by the evidence behind every score.</p>

        {strongest && weakest && strongest.id !== weakest.id && (
          <div className="report-category-contrast">
            <div><span>Strongest area</span><strong>{strongest.label}</strong><b>{strongest.score}</b></div>
            <div><span>Needs attention</span><strong>{weakest.label}</strong><b>{weakest.score}</b></div>
          </div>
        )}
      </div>

      <div className="report-meta">
        <span>{scoredCategories.length} categories analysed</span>
        <span>{new Date(scannedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        {(auditQuality || scanQuality) && <span><Eye /> {auditQuality ? AUDIT_QUALITY_COPY[auditQuality] : scanQuality!.jsRenderingUsed ? 'Browser rendered' : 'Static analysis'}</span>}
        {scanQuality?.performanceSource && scanQuality.performanceSource !== 'none' && <span><Gauge /> {scanQuality.performanceSource === 'browser' ? 'Performance measured in browser' : 'PageSpeed performance data'}</span>}
      </div>
    </section>
  );
}
