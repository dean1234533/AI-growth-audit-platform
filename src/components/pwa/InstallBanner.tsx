import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Share, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/Button';

const DISMISSED_KEY = 'ga_install_dismissed';
const ELIGIBLE_KEY = 'ga_pwa_eligible';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const eligible = localStorage.getItem(ELIGIBLE_KEY);
    if (!eligible) return;

    if (isIos()) {
      setIos(true);
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setVisible(true), 1200);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="glass fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl p-4 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.35)] sm:inset-x-auto sm:right-6 sm:bottom-6"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#6c63ff,#4b7cff)] text-white">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-white">Install Growth Audit</p>
            {ios ? (
              <p className="mt-1 text-xs leading-relaxed text-slate">
                Tap <Share className="inline size-3.5 -translate-y-0.5" /> Share, then "Add to Home Screen" for one-tap access and alerts.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-slate">
                Add it to your home screen for one-tap access and instant health alerts.
              </p>
            )}
            {!ios && (
              <Button size="md" className="mt-3 w-full" onClick={install}>
                Install
              </Button>
            )}
            {ios && (
              <Button size="md" variant="secondary" className="mt-3 w-full" onClick={dismiss}>
                Got it
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-slate transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function markPwaInstallEligible() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ELIGIBLE_KEY, '1');
  }
}
