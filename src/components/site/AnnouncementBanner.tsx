import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const DISMISSED_KEY = 'ga_app_scan_announcement_dismissed';

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISSED_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="animate-announcement-in relative z-50 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gradient-to-r from-brand-600 to-accent-600 px-4 py-2.5 text-center text-xs font-semibold text-white sm:text-sm"
    >
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      <span>New: we now detect web apps and score them fairly — no more penalties for missing local-business features like a phone number or opening hours.</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/20"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
