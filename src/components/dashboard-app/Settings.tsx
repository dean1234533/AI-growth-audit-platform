import { useEffect, useState } from 'react';
import { updateProfile, deleteUser, signOut } from 'firebase/auth';
import { collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { User, Bell, Trash2, Save } from 'lucide-react';
import { auth, db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { getUserSettings, saveUserSettings, type UserSettings } from '../../lib/userSettings';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';

export default function Settings() {
  const user = useAuthUser();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.uid).then((s) => {
      setSettings(s);
      setDisplayName(s.displayName || user.displayName || '');
    });
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateProfile(user, { displayName });
      await saveUserSettings(user.uid, { displayName, weeklyDigestEnabled: settings?.weeklyDigestEnabled ?? true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDigest() {
    if (!user || !settings) return;
    const next = { ...settings, weeklyDigestEnabled: !settings.weeklyDigestEnabled };
    setSettings(next);
    await saveUserSettings(user.uid, { weeklyDigestEnabled: next.weeklyDigestEnabled });
  }

  async function handleDeleteAccount() {
    if (!user) return;
    if (!window.confirm('Delete your account and all monitored websites? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      const sitesQuery = query(collection(db, 'websites'), where('uid', '==', user.uid));
      const sites = await getDocs(sitesQuery);
      await Promise.all(sites.docs.map((d) => deleteDoc(d.ref)));
      await deleteUser(user);
      window.location.href = '/';
    } catch {
      setError('Could not delete your account — try signing out and back in, then retry (Firebase requires a recent login for this action).');
      setDeleting(false);
    }
  }

  if (!user || !settings) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm font-medium text-slate">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Settings</span>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink dark:text-white">Account Settings</h1>
      </div>

      <GlassCard className="p-8">
        <div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
          <User className="size-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-ink dark:text-white">Profile</h2>
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm text-ink outline-none focus:border-brand-400 dark:border-white/10 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate">Email</label>
            <div className="mt-1.5 w-full rounded-2xl border border-ink/10 bg-ink/[0.02] px-4 py-3 text-sm text-slate dark:border-white/10 dark:bg-white/[0.02]">
              {user.email}
            </div>
          </div>
          {error && <p className="text-sm font-medium text-rose-500">{error}</p>}
          <Button onClick={handleSave} loading={saving} success={saved} icon={<Save className="size-4" />}>
            {saved ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="p-8">
        <div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
          <Bell className="size-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-ink dark:text-white">Notifications</h2>
        <button
          type="button"
          onClick={toggleDigest}
          className="mt-5 flex w-full items-center justify-between gap-4 rounded-2xl border border-ink/10 px-4 py-3.5 text-left dark:border-white/10"
        >
          <div>
            <div className="text-sm font-semibold text-ink dark:text-white">Weekly website health email</div>
            <div className="text-xs text-slate">A summary of scans, changes and recommendations, once a week.</div>
          </div>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${settings.weeklyDigestEnabled ? 'bg-brand-500' : 'bg-ink/15 dark:bg-white/15'}`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${settings.weeklyDigestEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </span>
        </button>
      </GlassCard>

      <GlassCard className="border-rose-500/20 p-8">
        <div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
          <Trash2 className="size-5" />
        </div>
        <h2 className="font-display text-lg font-bold text-ink dark:text-white">Danger Zone</h2>
        <p className="mt-2 text-sm text-slate">
          Permanently delete your account and every website you're monitoring. This cannot be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" onClick={() => signOut(auth)}>
            Sign Out
          </Button>
          <Button variant="ghost" loading={deleting} onClick={handleDeleteAccount} className="text-rose-500 hover:bg-rose-500/10">
            Delete Account
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
