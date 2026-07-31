import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { Sparkles, Send, Bot, User, ChevronDown, Zap, CalendarDays, CalendarRange } from 'lucide-react';
import { db } from '../../lib/firebaseClient';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import type { AuditResult, Recommendation } from '../../lib/types';

interface AiCoachProps {
  websiteId: string;
  siteName: string;
  audit: AuditResult;
  previous: AuditResult | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CompetitorSummary {
  name: string;
  score: number;
  previousScore: number | null;
}

const SUGGESTIONS = [
  "What's the most important thing I should fix?",
  'How do I fix this?',
  'Which issue could affect enquiries the most?',
  'Give me a step-by-step plan.',
];

const BUCKET_SIZE = 2;

interface ActionPlan {
  today: Recommendation[];
  thisWeek: Recommendation[];
  thisMonth: Recommendation[];
}

/** Deterministic bucketing from fields already on each recommendation — no extra AI call, no hallucination risk. Today = quick, high-severity wins; This Week = high-severity items needing more effort; This Month = everything else. */
function buildActionPlan(recommendations: Recommendation[]): ActionPlan {
  const today: Recommendation[] = [];
  const thisWeek: Recommendation[] = [];
  const thisMonth: Recommendation[] = [];

  for (const rec of recommendations) {
    const urgent = rec.severity === 'critical' || rec.severity === 'high';
    if (urgent && rec.difficulty === 'easy') today.push(rec);
    else if (urgent) thisWeek.push(rec);
    else thisMonth.push(rec);
  }

  return { today: today.slice(0, BUCKET_SIZE), thisWeek: thisWeek.slice(0, BUCKET_SIZE), thisMonth: thisMonth.slice(0, BUCKET_SIZE) };
}

function PriorityPlanItem({
  index,
  recommendation,
  onShowMe,
  explanation,
  loading,
}: {
  index: number;
  recommendation: Recommendation;
  onShowMe: () => void;
  explanation?: string;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  function handleToggle() {
    setOpen((o) => !o);
    if (!open && !explanation && !loading) onShowMe();
  }

  return (
    <div className="rounded-2xl border border-ink/10 p-4 dark:border-white/10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-300">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink dark:text-white">{recommendation.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate">{recommendation.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate">
            <span>
              Impact: <strong className="capitalize text-ink dark:text-white">{recommendation.impact}</strong>
            </span>
            <span>
              Difficulty: <strong className="capitalize text-ink dark:text-white">{recommendation.difficulty}</strong>
            </span>
            <span>
              Estimated effort: <strong className="text-ink dark:text-white">{recommendation.estimatedTime}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:underline"
          >
            Show me how
            <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 rounded-xl bg-brand-500/[0.06] p-3.5 text-xs leading-relaxed text-ink dark:text-slate-100">
                  {loading ? 'Thinking…' : explanation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function AiCoach({ websiteId, siteName, audit, previous }: AiCoachProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorSummary[]>([]);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, 'websites', websiteId, 'competitors')).then((snap) => {
      if (cancelled) return;
      setCompetitors(
        snap.docs.map((d) => {
          const data = d.data() as { name: string; latestOverallScore: number | null };
          return { name: data.name, score: data.latestOverallScore ?? 0, previousScore: null };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    const nextMessages: Message[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, siteName, audit, previous, competitors, history: nextMessages.slice(0, -1) }),
      });
      const json = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong');
      setMessages((m) => [...m, { role: 'assistant', content: json.answer ?? '' }]);
    } catch {
      setError("The coach couldn't answer that just now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function explainRecommendation(rec: Recommendation) {
    setExplaining(rec.id);
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: `Give me specific, step-by-step instructions to fix this issue on my website: "${rec.title}" — ${rec.description}`,
          siteName,
          audit,
          previous,
          competitors,
          history: [],
        }),
      });
      const json = (await res.json()) as { answer?: string; error?: string };
      setExplanations((e) => ({ ...e, [rec.id]: json.answer ?? "Couldn't generate an explanation — please try again." }));
    } catch {
      setExplanations((e) => ({ ...e, [rec.id]: "Couldn't generate an explanation — please try again." }));
    } finally {
      setExplaining(null);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const plan = buildActionPlan(audit.recommendations);
  const hasAnyPlanItems = plan.today.length + plan.thisWeek.length + plan.thisMonth.length > 0;

  const BUCKETS: { key: keyof ActionPlan; label: string; icon: typeof Zap }[] = [
    { key: 'today', label: 'Today', icon: Zap },
    { key: 'thisWeek', label: 'This Week', icon: CalendarDays },
    { key: 'thisMonth', label: 'This Month', icon: CalendarRange },
  ];

  return (
    <div className="space-y-6">
      <GlassCard gradientBorder id="coach" className="p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#4b7cff)] text-white">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink dark:text-white">Your Action Plan</h3>
            <p className="text-xs text-slate">What to fix, and when — in order of impact</p>
          </div>
        </div>

        {!hasAnyPlanItems ? (
          <p className="text-sm text-slate">No open recommendations right now — nice work.</p>
        ) : (
          <div className="space-y-6">
            {BUCKETS.map(({ key, label, icon: Icon }) => {
              const items = plan[key];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate">
                    <Icon className="size-3.5" /> {label}
                  </div>
                  <div className="space-y-3">
                    {items.map((rec, i) => (
                      <PriorityPlanItem
                        key={rec.id}
                        index={i + 1}
                        recommendation={rec}
                        onShowMe={() => explainRecommendation(rec)}
                        explanation={explanations[rec.id]}
                        loading={explaining === rec.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard gradientBorder className="p-7">
        <div className="mb-5">
          <h3 className="font-display text-lg font-bold text-ink dark:text-white">Ask AI about my website</h3>
          <p className="text-xs text-slate">Answers grounded in {siteName}'s real scan, trend and competitor data</p>
        </div>

        {messages.length === 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="glass rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-brand-500/10 dark:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="mb-5 max-h-[420px] space-y-4 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse text-right' : ''}`}
                >
                  <span
                    className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                      m.role === 'user' ? 'bg-ink/10 text-ink dark:bg-white/10 dark:text-white' : 'bg-brand-500/15 text-brand-500'
                    }`}
                  >
                    {m.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user' ? 'bg-brand-500 text-white' : 'glass text-ink dark:text-slate-100'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-500/15 text-brand-500">
                  <Bot className="size-3.5" />
                </span>
                Thinking…
              </div>
            )}
          </div>
        )}

        {error && <p className="mb-3 text-sm font-medium text-rose-500">{error}</p>}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your website's health…"
            disabled={loading}
            className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
          />
          <Button type="submit" loading={loading} icon={<Send className="size-4" />} className="shrink-0">
            Ask
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
