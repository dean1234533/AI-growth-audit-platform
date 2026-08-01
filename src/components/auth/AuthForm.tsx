import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  getAdditionalUserInfo,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebaseClient';
import { BRAND_EMAIL } from '../../lib/seo/site';
import { ensureUserDoc } from '../../lib/userSettings';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { markPwaInstallEligible } from '../pwa/InstallBanner';

function notifyAdminNewUser(email: string): void {
  fetch('/api/admin-notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'new_user', email }),
  }).catch(() => {});
}

function redirectToDashboard() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url');
  window.location.href = url ? `/dashboard?url=${encodeURIComponent(url)}` : '/dashboard';
}

function initialMode(): 'signin' | 'signup' {
  if (typeof window === 'undefined') return 'signin';
  return new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'signin';
}

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        redirectToDashboard();
      } else {
        setCheckingSession(false);
      }
    });
    return unsubscribe;
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cred =
        mode === 'signup'
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user.uid, cred.user.displayName ?? cred.user.email ?? '');
      if (mode === 'signup') {
        markPwaInstallEligible();
        notifyAdminNewUser(cred.user.email ?? email);
      }
      redirectToDashboard();
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.email !== BRAND_EMAIL) {
        await signOut(auth);
        setError('Google sign-in is reserved for the site admin. Please use email and password instead.');
        setLoading(false);
        return;
      }
      await ensureUserDoc(cred.user.uid, cred.user.displayName ?? cred.user.email ?? '');
      if (getAdditionalUserInfo(cred)?.isNewUser) {
        markPwaInstallEligible();
        notifyAdminNewUser(cred.user.email ?? '');
      }
      redirectToDashboard();
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Checking session…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mx-auto max-w-md">
      <GlassCard gradientBorder className="p-8">
        <img src="/logo.jpg" alt="" width="48" height="48" className="mb-2 size-12 rounded-2xl shadow-[0_16px_32px_-10px_rgba(59,130,246,0.55)]" />
        <h1 className="font-display text-2xl font-bold text-ink dark:text-white">
          {mode === 'signup' ? 'Create your free account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm text-slate">
          {mode === 'signup' ? 'Monitor your website automatically, for free.' : 'Log in to your website health dashboard.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-ink/10 px-4 py-3 focus-within:border-brand-400 dark:border-white/10">
            <Mail className="size-4 shrink-0 text-slate" />
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-slate/70 outline-none dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-ink/10 px-4 py-3 focus-within:border-brand-400 dark:border-white/10">
            <Lock className="size-4 shrink-0 text-slate" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-slate/70 outline-none dark:text-white"
            />
          </div>

          {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {mode === 'signup' ? 'Create Account' : 'Log In'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate">
          <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" /> or <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />
        </div>

        <Button type="button" variant="secondary" size="lg" onClick={handleGoogle} disabled={loading} className="w-full">
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-slate">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            className="font-semibold text-brand-500 hover:underline"
          >
            {mode === 'signup' ? 'Log in' : 'Create one free'}
          </button>
        </p>
      </GlassCard>
    </motion.div>
  );
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string } | undefined)?.code ?? '';
  if (code.includes('email-already-in-use')) return 'An account with that email already exists — try signing in instead.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Incorrect email or password.';
  }
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('popup-closed-by-user')) return 'Sign-in was cancelled.';
  return 'Something went wrong. Please try again.';
}
