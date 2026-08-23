import { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

const DISMISSED_KEY = 'ga_app_scan_announcement_dismissed';

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISSED_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div role="status" className="animate-announcement-in relative z-50 border-b border-white/10 bg-ink px-4 py-2 text-white dark:bg-[#080b12]">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 text-center text-[0.7rem] font-bold sm:text-xs">
        <span className="hidden rounded-full bg-white/10 px-2 py-0.5 uppercase tracking-[0.14em] text-brand-200 sm:inline">New</span>
        <span>Fairer scoring for web apps is now live.</span>
        <a href="/features" className="hidden items-center gap-1 text-brand-200 hover:text-white sm:inline-flex">See what changed <ArrowRight className="size-3" /></a>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, '1');
            setVisible(false);
          }}
          aria-label="Dismiss announcement"
          className="absolute right-2 flex size-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white sm:right-4"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
