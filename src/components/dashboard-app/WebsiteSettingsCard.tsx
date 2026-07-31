import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Globe, Save } from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { computeNextScanDue } from '../../lib/monitoring';
import { Button } from '../ui/Button';
import type { ScanFrequency } from '../../lib/types';

interface WebsiteDoc {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'paused';
  frequency: ScanFrequency;
  businessName?: string;
  industry?: string;
  location?: string;
}

const FREQUENCIES: { value: ScanFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'manual', label: 'Manual' },
];

interface WebsiteSettingsCardProps {
  uid: string;
}

export default function WebsiteSettingsCard({ uid }: WebsiteSettingsCardProps) {
  const [websites, setWebsites] = useState<WebsiteDoc[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'websites'), where('uid', '==', uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const sites = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WebsiteDoc, 'id'>) }));
      setWebsites(sites);
      setSelectedId((current) => current || sites[0]?.id || '');
    });
    return unsubscribe;
  }, [uid]);

  const selected = websites?.find((w) => w.id === selectedId) ?? null;

  useEffect(() => {
    setBusinessName(selected?.businessName ?? '');
    setIndustry(selected?.industry ?? '');
    setLocation(selected?.location ?? '');
  }, [selected?.id, selected?.businessName, selected?.industry, selected?.location]);

  async function handleSaveDetails() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'websites', selected.id), { businessName, industry, location });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleFrequencyChange(frequency: ScanFrequency) {
    if (!selected) return;
    const nextScanDue = computeNextScanDue(frequency, new Date());
    await updateDoc(doc(db, 'websites', selected.id), {
      frequency,
      nextScanDue: nextScanDue ? Timestamp.fromDate(nextScanDue) : null,
    });
  }

  async function handleToggleStatus() {
    if (!selected) return;
    await updateDoc(doc(db, 'websites', selected.id), { status: selected.status === 'active' ? 'paused' : 'active', updatedAt: serverTimestamp() });
  }

  if (websites === null) {
    return <div className="h-32 animate-pulse rounded-2xl bg-ink/5 dark:bg-white/5" />;
  }

  if (websites.length === 0) {
    return <p className="text-sm text-slate">Add a website to monitor from the Dashboard to configure it here.</p>;
  }

  return (
    <div>
      {websites.length > 1 && (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mb-5 w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:bg-[#0a0a12] dark:text-white"
        >
          {websites.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      {selected && (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate">Website URL</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-ink/10 bg-ink/[0.02] px-4 py-3 text-sm text-slate dark:border-white/10 dark:bg-white/[0.02]">
              <Globe className="size-4 shrink-0" /> {selected.url}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate">Business name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={selected.name}
                className="mt-1.5 w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Painters & decorators"
                className="mt-1.5 w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. London"
                className="mt-1.5 w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
              />
            </div>
          </div>

          <Button size="md" variant="secondary" onClick={handleSaveDetails} loading={saving} success={saved} icon={<Save className="size-4" />}>
            {saved ? 'Saved' : 'Save Details'}
          </Button>

          <div className="border-t border-ink/[0.06] pt-5 dark:border-white/10">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate">Monitoring status</label>
              <button type="button" onClick={handleToggleStatus}>
                <span className={`relative block h-6 w-11 rounded-full transition-colors ${selected.status === 'active' ? 'bg-brand-500' : 'bg-ink/15 dark:bg-white/15'}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${selected.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </span>
              </button>
            </div>

            <label className="text-xs font-semibold text-slate">Scan frequency</label>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFrequencyChange(f.value)}
                  className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    selected.frequency === f.value
                      ? 'border-brand-400 bg-brand-500/10 text-ink dark:text-white'
                      : 'border-ink/10 text-slate hover:border-ink/20 dark:border-white/10 dark:hover:border-white/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
