import { ArrowRight, TrendingUp } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { SeverityBadge } from '../ui/SeverityBadge';
import { buildGrowthOpportunities } from '../../lib/opportunities';
import type { Recommendation } from '../../lib/types';

interface GrowthOpportunitiesProps {
  recommendations: Recommendation[];
}

/** Translates the top technical issues into business-framed opportunities — same recommendation data already computed for the audit, just reframed for "why this matters to the business" rather than "what's broken". */
export function GrowthOpportunities({ recommendations }: GrowthOpportunitiesProps) {
  const opportunities = buildGrowthOpportunities(recommendations);
  if (opportunities.length === 0) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-mint-500/10 text-mint-600">
          <TrendingUp className="size-4.5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-ink dark:text-white">Growth Opportunities</h2>
          <p className="text-xs text-slate">What these issues could mean for your business, not just your code</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {opportunities.map((op) => (
          <GlassCard key={op.id} static className="p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate">Technical issue</span>
              <SeverityBadge severity={op.severity} />
            </div>
            <p className="text-sm font-semibold text-ink dark:text-white">{op.technicalIssue}</p>
            <div className="my-3 flex items-center gap-2 text-slate">
              <ArrowRight className="size-3.5" />
              <span className="text-xs font-bold uppercase tracking-wide">Business opportunity</span>
            </div>
            <p className="text-sm leading-relaxed text-slate">{op.businessOpportunity}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
