import { Wrench, CalendarClock, MessageCircle, Sparkles } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { buildServiceRecommendations } from '../../lib/serviceRecommendations';
import { CONSULTATION_URL } from '../../lib/seo/site';
import type { AuditResult } from '../../lib/types';

interface HowICanHelpProps {
  audit: AuditResult;
  onGetFixed: (serviceTitle?: string) => void;
  onAskAi?: () => void;
}

/** "Want these opportunities fixed?" — dynamically recommends only the services the audit actually evidences, then offers a clear next step. Not a tool hub: this is the conversion step of the one core product. */
export function HowICanHelp({ audit, onGetFixed, onAskAi }: HowICanHelpProps) {
  const services = buildServiceRecommendations(audit);

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
                <button
                  type="button"
                  onClick={() => onGetFixed(s.title)}
                  className="mt-3 text-xs font-semibold text-brand-500 hover:underline"
                >
                  Ask about this →
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => onGetFixed()} icon={<Wrench className="size-4" />}>
            Get These Fixed
          </Button>
          <Button size="lg" variant="secondary" onClick={() => window.open(CONSULTATION_URL, '_blank')} icon={<CalendarClock className="size-4" />}>
            Book a Free Consultation
          </Button>
          {onAskAi && (
            <Button size="lg" variant="secondary" onClick={onAskAi} icon={<MessageCircle className="size-4" />}>
              Ask AI What I Should Do
            </Button>
          )}
        </div>
      </GlassCard>

      <GlassCard static className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-500/10 text-mint-600">
            <Sparkles className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink dark:text-white">Need more than a website?</p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate">
              I also build custom web apps, booking systems, dashboards, CRMs, automation and AI-powered business
              tools tailored to how your business operates.
            </p>
          </div>
        </div>
        <Button size="md" variant="ghost" onClick={() => onGetFixed('Custom project')}>
          Discuss a Custom Project
        </Button>
      </GlassCard>
    </div>
  );
}
