import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ExternalLink } from 'lucide-react';
import { useAuthUser } from '../../lib/useAuthUser';
import { getUserSettings } from '../../lib/userSettings';
import { PLANS } from '../../lib/plans';
import type { PlanId, UserSettings } from '../../lib/userSettings';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';

/** The plan-management UI, embedded as a Settings section rather than its own page. */
export default function BillingSection() {
  const user = useAuthUser();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.uid).then(setSettings);

    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) setNotice("You're on Pro! It may take a few seconds to reflect below.");
    if (params.get('canceled')) setNotice('Checkout was canceled — you were not charged.');
  }, [user]);

  async function handleUpgrade() {
    if (!user) return;
    setBusyPlan('pro');
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Could not start checkout.');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.');
      setBusyPlan(null);
    }
  }

  async function handleManageBilling() {
    if (!user || !settings?.stripeCustomerId) return;
    setBusyPlan('pro');
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerId: settings.stripeCustomerId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Could not open the billing portal.');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal. Please try again.');
      setBusyPlan(null);
    }
  }

  if (!user || settings === null) {
    return <div className="h-32 animate-pulse rounded-2xl bg-ink/5 dark:bg-white/5" />;
  }

  const plan = settings.plan;

  return (
    <>
      <p className="mt-1 text-sm text-slate">
        You're currently on the <strong className="text-ink dark:text-white">{PLANS.find((p) => p.id === plan)?.name}</strong> plan.
      </p>

      {notice && <div className="mt-4 rounded-2xl bg-ink/[0.03] px-5 py-3.5 text-sm font-medium text-ink dark:bg-white/[0.03] dark:text-white">{notice}</div>}
      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-500/[0.06] px-5 py-3.5 text-sm text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-400">
          <CreditCard className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {PLANS.map((p) => (
          <GlassCard key={p.id} gradientBorder={p.id === plan} className="flex flex-col p-6">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-500">{p.name}</span>
            <div className="mt-2 font-display text-2xl font-extrabold text-ink dark:text-white">{p.price}</div>
            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-ink dark:text-slate-100">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-mint-500" /> {f}
                </li>
              ))}
            </ul>
            {p.id === plan ? (
              p.id === 'pro' ? (
                <Button
                  size="md"
                  variant="secondary"
                  className="mt-5 w-full"
                  loading={busyPlan === 'pro'}
                  icon={<ExternalLink className="size-4" />}
                  onClick={handleManageBilling}
                >
                  Manage Billing
                </Button>
              ) : (
                <div className="mt-5 rounded-2xl bg-brand-500/10 px-4 py-2.5 text-center text-sm font-semibold text-brand-600">Current plan</div>
              )
            ) : p.id === 'pro' ? (
              <Button size="md" className="mt-5 w-full" loading={busyPlan === 'pro'} onClick={handleUpgrade}>
                Upgrade to Pro
              </Button>
            ) : (
              <div className="mt-5 rounded-2xl px-4 py-2.5 text-center text-xs font-semibold text-slate">Downgrade via Manage Billing</div>
            )}
          </GlassCard>
        ))}
      </div>
    </>
  );
}
