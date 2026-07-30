import { useEffect, useState, type FormEvent } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Users, Plus, TrendingUp, TrendingDown, Minus, Sparkles, Check } from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { addCompetitorWithFirstScan } from '../../lib/monitoring';
import { ApiError } from '../../lib/api';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';

interface CompetitorDoc {
  id: string;
  name: string;
  url: string;
  latestOverallScore: number | null;
}

interface CompetitorSuggestion {
  name: string;
  url: string;
}

interface CompetitorsSectionProps {
  websiteId: string;
  ourScore: number;
  siteUrl: string;
  pageTitle: string | null;
}

export default function CompetitorsSection({ websiteId, ourScore, siteUrl, pageTitle }: CompetitorsSectionProps) {
  const [competitors, setCompetitors] = useState<CompetitorDoc[] | null>(null);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[] | null>(null);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'websites', websiteId, 'competitors'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCompetitors(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CompetitorDoc, 'id'>) })));
    });
    return unsubscribe;
  }, [websiteId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addCompetitorWithFirstScan(websiteId, url.trim());
      setUrl('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not scan this competitor. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  async function handleFindCompetitors() {
    setFinding(true);
    setFindError(null);
    setSuggestions(null);
    try {
      const res = await fetch('/api/find-competitors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ siteUrl, pageTitle }),
      });
      const json = (await res.json()) as { suggestions?: CompetitorSuggestion[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not find competitors.');
      const existingUrls = new Set((competitors ?? []).map((c) => c.url));
      setSuggestions((json.suggestions ?? []).filter((s) => !existingUrls.has(s.url)));
    } catch (err) {
      setFindError(err instanceof Error ? err.message : 'Could not find competitors. Please try again.');
    } finally {
      setFinding(false);
    }
  }

  async function handleAddSuggestion(suggestionUrl: string) {
    setAddingUrl(suggestionUrl);
    try {
      await addCompetitorWithFirstScan(websiteId, suggestionUrl);
      setAddedUrls((s) => new Set(s).add(suggestionUrl));
    } catch {
      setFindError('Could not add that competitor. Please try again.');
    } finally {
      setAddingUrl(null);
    }
  }

  return (
    <GlassCard gradientBorder id="competitors" className="p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white">
            <Users className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink dark:text-white">Competitors</h3>
            <p className="text-xs text-slate">Compared using the same audit engine, scanned weekly</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="md" variant="secondary" icon={<Sparkles className="size-4" />} loading={finding} onClick={handleFindCompetitors}>
            Find Competitors
          </Button>
          <Button size="md" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setShowForm((s) => !s)}>
            Add
          </Button>
        </div>
      </div>

      {findError && <p className="mb-4 text-sm font-medium text-rose-500">{findError}</p>}

      {suggestions && (
        <div className="mb-5 space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate">No new competitors found — try adding one manually.</p>
          ) : (
            suggestions.map((s) => {
              const added = addedUrls.has(s.url);
              return (
                <div key={s.url} className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 px-4 py-3 dark:border-white/10">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink dark:text-white">{s.name}</div>
                    <div className="truncate text-xs text-slate">{s.url}</div>
                  </div>
                  <Button
                    size="md"
                    variant={added ? 'ghost' : 'secondary'}
                    loading={addingUrl === s.url}
                    disabled={added}
                    icon={added ? <Check className="size-4" /> : <Plus className="size-4" />}
                    onClick={() => handleAddSuggestion(s.url)}
                  >
                    {added ? 'Added' : 'Add'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 flex items-center gap-2">
          <input
            type="text"
            required
            placeholder="competitor.co.uk"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={adding}
            className="w-full rounded-2xl border border-ink/10 px-4 py-2.5 text-sm text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
          />
          <Button type="submit" size="md" loading={adding} className="shrink-0">
            Scan
          </Button>
        </form>
      )}

      {error && <p className="mb-3 text-sm font-medium text-rose-500">{error}</p>}

      {competitors === null ? (
        <div className="h-16 animate-pulse rounded-2xl bg-ink/5 dark:bg-white/5" />
      ) : competitors.length === 0 ? (
        <p className="text-sm text-slate">No competitors added yet — add one to see how you compare.</p>
      ) : (
        <div className="space-y-3">
          {competitors.map((c) => {
            const score = c.latestOverallScore ?? 0;
            const diff = ourScore - score;
            return (
              <div key={c.id} className="glass flex items-center justify-between gap-4 rounded-2xl px-4 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink dark:text-white">{c.name}</div>
                  <div className="truncate text-xs text-slate">{c.url}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold text-ink dark:text-white">{score}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                      diff > 0 ? 'bg-mint-500/10 text-mint-600' : diff < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-slate/10 text-slate'
                    }`}
                  >
                    {diff > 0 ? <TrendingUp className="size-3.5" /> : diff < 0 ? <TrendingDown className="size-3.5" /> : <Minus className="size-3.5" />}
                    {diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${diff} vs you`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
