import { Wrench, CalendarClock, MessageCircle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { buildServiceRecommendations } from '../../lib/serviceRecommendations';
import { CONSULTATION_URL } from '../../lib/seo/site';
import type { AuditResult } from '../../lib/types';

interface HowICanHelpProps {
  audit: AuditResult;
  onGetFixed: (serviceTitle?: string) => void;
  onBook?: () => void;
  onAskAi?: () => void;
}

/** "Want these opportunities fixed?" — dynamically recommends only the services the audit actually evidences, then offers a clear next step. Not a tool hub: this is the conversion step of the one core product. */
export function HowICanHelp({ audit, onGetFixed, onBook, onAskAi }: HowICanHelpProps) {
  const services = buildServiceRecommendations(audit);
  const handleBook = onBook ?? (() => window.open(CONSULTATION_URL, '_blank', 'noopener,noreferrer'));

  return (
    <div className="space-y-6">
      <GlassCard gradientBorder className="p-7">
        <h2 className="font-display text-xl font-bold text-ink dark:text-white">Want these opportunities fixed?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
          Your audit has identified areas where your website could generate more enquiries, improve visibility or
          provide a better customer experience.
        </p>

        {services.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                    <Wrench className="size-4" />
                  </span>
                  <span className="text-sm font-bold text-ink dark:text-white">{s.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate">{s.reason}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={handleBook} icon={<CalendarClock className="size-4" />}>
            Book My Free Website Review
          </Button>
          <button type="button" onClick={() => onGetFixed()} className="min-h-11 px-3 text-sm font-semibold text-slate hover:text-brand-500">
            Prefer email? Send your details
          </button>
          {onAskAi && (
            <Button size="md" variant="ghost" onClick={onAskAi} icon={<MessageCircle className="size-4" />}>
              Ask AI about these results
            </Button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
