import { useEffect, useState, type FormEvent } from 'react';
import { collection, deleteDoc, doc, query, onSnapshot } from 'firebase/firestore';
import { Users, Plus, TrendingUp, TrendingDown, Minus, Sparkles, Check, ChevronDown, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { addCompetitorWithFirstScan } from '../../lib/monitoring';
import { ApiError } from '../../lib/api';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import type { CategoryScore } from '../../lib/types';

interface CompetitorDoc {
  id: string;
  name: string;
  url: string;
  latestOverallScore: number | null;
  latestCategoryScores: { id: string; score: number }[] | null;
}

interface CompetitorSuggestion {
  name: string;
  url: string;
}

interface CompetitorsSectionProps {
  websiteId: string;
  ourScore: number;
  ourCategories: CategoryScore[];
  siteUrl: string;
  pageTitle: string | null;
}

function biggestGap(ourCategories: CategoryScore[], theirs: { id: string; score: number }[]): { label: string; diff: number } | null {
  let worst: { label: string; diff: number } | null = null;
  for (const cat of ourCategories) {
    const theirScore = theirs.find((t) => t.id === cat.id)?.score;
    if (theirScore === undefined) continue;
    const diff = cat.score - theirScore; // negative = they're ahead
    if (!worst || diff < worst.diff) worst = { label: cat.label, diff };
  }
  return worst;
}

export default function CompetitorsSection({ websiteId, ourScore, ourCategories, siteUrl, pageTitle }: CompetitorsSectionProps) {
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  async function handleRemove(competitorId: string) {
    setRemovingId(competitorId);
    try {
      await deleteDoc(doc(db, 'websites', websiteId, 'competitors', competitorId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <GlassCard gradientBorder className="p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#4b7cff)] text-white">
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
            const theirCategories = c.latestCategoryScores ?? [];
            const expanded = expandedId === c.id;
            const gap = biggestGap(ourCategories, theirCategories);

            return (
              <div key={c.id} className="glass rounded-2xl px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
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
                    <ChevronDown className={`size-4 shrink-0 text-slate transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 border-t border-ink/[0.06] pt-4 dark:border-white/10">
                    {gap && (
                      <p className="mb-3 text-xs font-semibold text-ink dark:text-white">
                        {gap.diff < 0
                          ? `They're beating you most on ${gap.label} (${gap.diff} points behind).`
                          : `You're ahead of them on every category we could compare — biggest lead: ${gap.label} (+${gap.diff}).`}
                      </p>
                    )}
                    {theirCategories.length === 0 ? (
                      <p className="text-xs text-slate">Category breakdown isn't available for this competitor yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ourCategories.map((cat) => {
                          const theirScore = theirCategories.find((t) => t.id === cat.id)?.score;
                          if (theirScore === undefined) return null;
                          const catDiff = cat.score - theirScore;
                          return (
                            <div key={cat.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-slate">{cat.label}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-ink dark:text-white">
                                  {cat.score} <span className="text-slate">vs</span> {theirScore}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-bold ${
                                    catDiff > 0 ? 'bg-mint-500/10 text-mint-600' : catDiff < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-slate/10 text-slate'
                                  }`}
                                >
                                  {catDiff === 0 ? '0' : `${catDiff > 0 ? '+' : ''}${catDiff}`}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      size="md"
                      variant="ghost"
                      loading={removingId === c.id}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => handleRemove(c.id)}
                      className="mt-4 text-rose-500 hover:bg-rose-500/10"
                    >
                      Remove competitor
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
