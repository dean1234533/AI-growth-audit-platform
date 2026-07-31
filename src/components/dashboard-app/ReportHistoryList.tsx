import { useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { generateAuditPdf } from '../../lib/pdf';
import type { AuditResult, ScanFrequency } from '../../lib/types';

interface ReportHistoryListProps {
  scans: (AuditResult & { id: string })[];
  frequency: ScanFrequency;
  websiteName: string;
  websiteUrl: string;
  userName: string;
  userEmail: string;
}

const FREQUENCY_LABEL: Record<ScanFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  manual: 'Manual',
};

export default function ReportHistoryList({ scans, frequency, websiteName, websiteUrl, userName, userEmail }: ReportHistoryListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ordered = [...scans].reverse();

  function handleDownload(scan: AuditResult) {
    generateAuditPdf(scan, { name: userName || 'Website Owner', email: userEmail, business: websiteName, website: websiteUrl });
  }

  return (
    <div className="space-y-2.5">
      {ordered.map((scan, i) => {
        const isFirst = i === ordered.length - 1;
        const title = isFirst ? 'Initial Website Audit' : `${FREQUENCY_LABEL[frequency]} Website Growth Report`;
        const open = openId === scan.id;

        return (
          <div key={scan.id} className="rounded-2xl border border-ink/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : scan.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink dark:text-white">{title}</div>
                <div className="text-xs text-slate">
                  {new Date(scan.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Score: {scan.overallScore}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(scan);
                  }}
                  role="button"
                  tabIndex={0}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <Download className="size-3.5" /> PDF
                </span>
                <ChevronDown className={`size-4 text-slate transition-transform ${open ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {open && (
              <div className="border-t border-ink/[0.06] px-4 py-4 dark:border-white/10">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {scan.categories.map((c) => (
                    <div key={c.id} className="rounded-xl bg-ink/[0.03] px-3 py-2 text-center dark:bg-white/[0.03]">
                      <div className="font-display text-lg font-bold text-ink dark:text-white">{c.score}</div>
                      <div className="text-[11px] text-slate">{c.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate">{scan.recommendations.length} open recommendation{scan.recommendations.length === 1 ? '' : 's'} at time of scan.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
