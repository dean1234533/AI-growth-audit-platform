import { useState } from 'react';
import { Mail, MessageSquare, Send, RefreshCw, Copy, Check, Link2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Button } from '../ui/Button';

type Channel = 'email' | 'sms' | 'social';

const CHANNELS: { id: Channel; label: string; icon: typeof Mail }[] = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'social', label: 'Social DM', icon: Send },
];

interface OutreachPanelProps {
  user: User;
  business: string;
  website: string;
  findings: string[];
}

/** The one outreach workspace: pick a channel, generate a message from the real findings already attached to this lead, edit, copy, done. No separate page, no extra navigation. */
export function OutreachPanel({ user, business, website, findings }: OutreachPanelProps) {
  const [channel, setChannel] = useState<Channel>('email');
  const [message, setMessage] = useState('');
  const [auditUrl, setAuditUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  async function generate(nextChannel: Channel = channel) {
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/outreach', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ business, website, findings, channel: nextChannel }),
      });
      const json = (await res.json()) as { message?: string; auditUrl?: string; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error ?? 'Could not generate a message.');
      setMessage(json.message);
      setAuditUrl(json.auditUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a message.');
    } finally {
      setLoading(false);
    }
  }

  function handleChannelChange(next: Channel) {
    setChannel(next);
    generate(next);
  }

  function copy(text: string, mark: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    mark(true);
    setTimeout(() => mark(false), 1500);
  }

  return (
    <div className="mt-4 space-y-4 border-t border-ink/[0.06] pt-4 dark:border-white/10">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">Why this message</div>
        <ul className="space-y-1">
          {findings.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink dark:text-slate-100">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHANNELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleChannelChange(id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              channel === id ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-slate hover:bg-ink/5 dark:hover:bg-white/5'
            }`}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {message ? (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm leading-relaxed text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-ink/10 p-6 text-center text-sm text-slate dark:border-white/10">
          {loading ? 'Generating…' : 'Generate a message to get started.'}
        </div>
      )}

      {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

      {auditUrl && (
        <div className="flex items-center gap-2 rounded-xl bg-ink/[0.03] px-3.5 py-2.5 text-xs text-slate dark:bg-white/[0.03]">
          <Link2 className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{auditUrl}</span>
          <button type="button" onClick={() => copy(auditUrl, setCopiedLink)} className="shrink-0 font-semibold text-brand-500 hover:underline">
            {copiedLink ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="md" variant="secondary" onClick={() => generate()} loading={loading} icon={<RefreshCw className="size-4" />}>
          {message ? 'Regenerate' : 'Generate'}
        </Button>
        {message && (
          <Button size="md" onClick={() => copy(message, setCopiedMessage)} icon={copiedMessage ? <Check className="size-4" /> : <Copy className="size-4" />}>
            {copiedMessage ? 'Copied' : 'Copy Message'}
          </Button>
        )}
      </div>
    </div>
  );
}
