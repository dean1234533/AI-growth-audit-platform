import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { useAuthUser } from '../../lib/useAuthUser';
import { getUserSettings } from '../../lib/userSettings';
import { PLANS } from '../../lib/plans';
import type { PlanId } from '../../lib/userSettings';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { CONSULTATION_URL } from '../../lib/seo/site';

export default function Billing() {
  const user = useAuthUser();
  const [plan, setPlan] = useState<PlanId | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.uid).then((s) => setPlan(s.plan));
  }, [user]);

  if (!user || plan === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Billing</span>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">Plan &amp; Billing</h1>
        <p className="mt-2 text-sm text-slate">
          You're currently on the <strong className="text-ink dark:text-white">{PLANS.find((p) => p.id === plan)?.name}</strong> plan.
        </p>
      </div>

      <div className="glass mb-8 flex items-start gap-3 rounded-2xl px-5 py-4 text-sm text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-300">
        <CreditCard className="mt-0.5 size-4 shrink-0" />
        <span>
          Self-service upgrades aren't live yet — get in touch and we'll upgrade your account directly while that's being wired up.
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((p) => (
          <GlassCard key={p.id} gradientBorder={p.id === plan} className="flex flex-col p-8">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-500">{p.name}</span>
            <div className="mt-3 font-display text-3xl font-extrabold text-ink dark:text-white">{p.price}</div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink dark:text-slate-100">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-500" /> {f}
                </li>
              ))}
            </ul>
            {p.id === plan ? (
              <div className="mt-6 rounded-2xl bg-brand-500/10 px-4 py-2.5 text-center text-sm font-semibold text-brand-600">Current plan</div>
            ) : (
              <Button
                variant="secondary"
                className="mt-6 w-full"
                onClick={() => window.open(CONSULTATION_URL, '_blank')}
              >
                Contact to Upgrade
              </Button>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
