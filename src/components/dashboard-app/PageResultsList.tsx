import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AuditResult, PageAuditResult } from '../../lib/types';

interface PageResultsListProps {
  audit: AuditResult;
}

/** Per-page scores — the homepage's own full breakdown lives in the Category Breakdown grid below; this is the "which of my other pages need attention" view. */
export default function PageResultsList({ audit }: PageResultsListProps) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const pages = audit.pages ?? [];
  if (pages.length === 0) return null;

  const homepageEntry: PageAuditResult = { url: audit.url, overallScore: audit.overallScore, categories: audit.categories };
  const allPages = [homepageEntry, ...pages];

  return (
    <div>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate">Page-level results</h3>
      <div className="space-y-2">
        {allPages.map((p) => {
          const open = openUrl === p.url;
          const path = (() => {
            try {
              const u = new URL(p.url);
              return u.pathname === '/' ? 'Homepage' : u.pathname;
            } catch {
              return p.url;
            }
          })();
          return (
            <div key={p.url} className="rounded-2xl border border-ink/10 dark:border-white/10">
              <button
                type="button"
                onClick={() => setOpenUrl(open ? null : p.url)}
                className="flex w-full items-center justify-between gap-3 p-3.5 text-left"
              >
                <span className="truncate text-sm font-semibold text-ink dark:text-white">{path}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-display text-base font-bold text-ink dark:text-white">{p.overallScore}</span>
                  <ChevronDown className={`size-3.5 text-slate transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {open && (
                <div className="grid grid-cols-2 gap-2 border-t border-ink/[0.06] p-3.5 sm:grid-cols-4 dark:border-white/10">
                  {p.categories
                    .filter((c) => c.checks.length > 0)
                    .map((c) => (
                      <div key={c.id} className="rounded-xl bg-ink/[0.03] px-3 py-2 text-center dark:bg-white/[0.03]">
                        <div className="font-display text-lg font-bold text-ink dark:text-white">{c.score}</div>
                        <div className="text-[11px] text-slate">{c.label}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
