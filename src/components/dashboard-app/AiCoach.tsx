import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Bot, User } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import type { AuditResult } from '../../lib/types';

interface AiCoachProps {
  siteName: string;
  audit: AuditResult;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What should I improve this week?',
  'What should I prioritise first?',
  'Why is my score low?',
  'How do I get more enquiries?',
];

export default function AiCoach({ siteName, audit }: AiCoachProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ question, siteName, audit, history: nextMessages.slice(0, -1) }),
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <GlassCard gradientBorder id="coach" className="p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold text-ink dark:text-white">AI SEO Coach</h3>
          <p className="text-xs text-slate">Answers grounded in {siteName}'s real scan data</p>
        </div>
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
  );
}
