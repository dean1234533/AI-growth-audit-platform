import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuthUser } from '../../lib/useAuthUser';
import { GlassCard } from '../ui/GlassCard';
import type { LeadStatus, StoredLead } from '../../lib/types';

const STATUS_OPTIONS: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

const STATUS_COLOR: Record<LeadStatus, string> = {
  new: 'bg-brand-500/10 text-brand-600',
  contacted: 'bg-amber-500/10 text-amber-600',
  qualified: 'bg-accent-500/10 text-accent-600',
  proposal: 'bg-violet-500/10 text-violet-500',
  won: 'bg-mint-500/10 text-mint-600',
  lost: 'bg-slate/10 text-slate',
};

export default function AdminLeadsView() {
  const user = useAuthUser();
  const [leads, setLeads] = useState<StoredLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/leads', { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) {
          setError(res.status === 403 ? 'Not authorized' : 'Something went wrong loading leads.');
          return;
        }
        const json = (await res.json()) as { leads: StoredLead[] };
        setLeads(json.leads);
      } catch {
        setError('Something went wrong loading leads.');
      }
    })();
  }, [user]);

  async function updateStatus(id: string, status: LeadStatus) {
    if (!user) return;
    setLeads((ls) => ls?.map((l) => (l.id === id ? { ...l, status } : l)) ?? ls);
    const token = await user.getIdToken();
    await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <GlassCard className="flex flex-col items-center gap-4 p-16">
          <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="size-6" />
          </span>
          <h1 className="font-display text-xl font-bold text-ink dark:text-white">{error}</h1>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-16">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Admin</span>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">Leads</h1>
      </div>

      {leads === null ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate">Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-slate">No leads yet.</div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <GlassCard key={lead.id} static className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-bold text-ink dark:text-white">{lead.name}</span>
                    <span className="text-xs text-slate">{lead.business}</span>
                    <span className="rounded-full bg-slate/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate">{lead.source}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate">
                    {lead.email} · {lead.website}
                  </div>
                  {lead.helpWith && <div className="mt-2 text-sm text-ink dark:text-slate-100">Wants help with: {lead.helpWith}</div>}
                  {lead.message && <div className="mt-1 text-xs text-slate">"{lead.message}"</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate">
                    {lead.auditScore != null && <span>Score: {lead.auditScore}/100</span>}
                    {lead.topIssues && lead.topIssues.length > 0 && <span>Top issue: {lead.topIssues[0]}</span>}
                    {lead.recommendedServices && lead.recommendedServices.length > 0 && (
                      <span>Suggested: {lead.recommendedServices.join(', ')}</span>
                    )}
                    {lead.createdAt && <span>{new Date(lead.createdAt).toLocaleDateString('en-GB')}</span>}
                  </div>
                </div>
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                  className={`shrink-0 rounded-full border-0 px-3 py-1.5 text-xs font-bold uppercase outline-none ${STATUS_COLOR[lead.status]}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
