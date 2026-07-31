import { useEffect, useState } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { Button } from '../ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaStatusCard() {
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstalling(false);
  }

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-mint-500/[0.06] px-4 py-3.5 text-sm font-semibold text-mint-600 ring-1 ring-inset ring-mint-500/15">
        <CheckCircle2 className="size-4 shrink-0" /> Installed — you're using Growth Audit as an app.
      </div>
    );
  }

  if (isIos()) {
    return (
      <div className="rounded-2xl border border-ink/10 px-4 py-3.5 text-sm text-slate dark:border-white/10">
        Tap the Share icon in Safari, then "Add to Home Screen" to install Growth Audit.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 px-4 py-3.5 dark:border-white/10">
      <div>
        <div className="text-sm font-semibold text-ink dark:text-white">Not installed</div>
        <div className="text-xs text-slate">Install for instant alerts and one-tap access.</div>
      </div>
      <Button size="md" variant="secondary" loading={installing} disabled={!deferredPrompt} icon={<Smartphone className="size-4" />} onClick={handleInstall}>
        Install
      </Button>
    </div>
  );
}
