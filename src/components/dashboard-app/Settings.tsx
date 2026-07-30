import { useEffect, useState } from 'react';
import { updateProfile, deleteUser, signOut } from 'firebase/auth';
import { collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { User, Bell, Trash2, Save, Smartphone, X } from 'lucide-react';
import { auth, db } from '../../lib/firebaseClient';
import { useAuthUser } from '../../lib/useAuthUser';
import { getUserSettings, saveUserSettings, type UserSettings, type NotificationPref } from '../../lib/userSettings';
import {
  isPushSupported,
  listPushSubscriptions,
  pushPermission,
  removePushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  type StoredPushSubscription,
} from '../../lib/pushSubscribe';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';

const NOTIFICATION_PREF_OPTIONS: { id: NotificationPref; label: string; hint: string }[] = [
  { id: 'push', label: 'Push only', hint: 'Instant alerts on this device, no email.' },
  { id: 'email', label: 'Email only', hint: 'A weekly digest and important alerts by email.' },
  { id: 'both', label: 'Push + Email', hint: 'Instant alerts plus a weekly email summary.' },
  { id: 'none', label: 'None', hint: "Don't notify me — I'll check the dashboard myself." },
];

export default function Settings() {
  const user = useAuthUser();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<StoredPushSubscription[]>([]);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserSettings(user.uid).then((s) => {
      setSettings(s);
      setDisplayName(s.displayName || user.displayName || '');
    });
    listPushSubscriptions(user.uid).then(setDevices);
  }, [user]);

  async function handleEnablePush() {
    if (!user) return;
    setPushBusy(true);
    setPushError(null);
    const result = await subscribeToPush(user.uid);
    if (!result.ok) {
      setPushError(result.reason ?? 'Could not enable push notifications.');
    } else {
      setDevices(await listPushSubscriptions(user.uid));
    }
    setPushBusy(false);
  }

  async function handleRemoveDevice(subId: string, endpoint: string) {
    if (!user) return;
    let isThisDevice = false;
    if (isPushSupported()) {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      isThisDevice = current?.endpoint === endpoint;
    }
    if (isThisDevice) {
      await unsubscribeFromPush(user.uid);
    } else {
      await removePushSubscription(user.uid, subId);
    }
    setDevices(await listPushSubscriptions(user.uid));
  }

  async function updateNotificationPref(pref: NotificationPref) {
    if (!user || !settings) return;
    const next = { ...settings, notificationPref: pref };
    setSettings(next);
    await saveUserSettings(user.uid, { notificationPref: pref });
  }

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

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_PREF_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => updateNotificationPref(opt.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                settings.notificationPref === opt.id
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-ink/10 hover:border-ink/20 dark:border-white/10 dark:hover:border-white/20'
              }`}
            >
              <div className="text-sm font-semibold text-ink dark:text-white">{opt.label}</div>
              <div className="mt-0.5 text-xs text-slate">{opt.hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex w-full items-center justify-between gap-4 rounded-2xl border border-ink/10 px-4 py-3.5 dark:border-white/10">
          <div>
            <div className="text-sm font-semibold text-ink dark:text-white">Weekly website health email</div>
            <div className="text-xs text-slate">A summary of scans, changes and recommendations, once a week.</div>
          </div>
          <button type="button" onClick={toggleDigest} aria-label="Toggle weekly digest email">
            <span
              className={`relative block h-6 w-11 shrink-0 rounded-full transition-colors ${settings.weeklyDigestEnabled ? 'bg-brand-500' : 'bg-ink/15 dark:bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${settings.weeklyDigestEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </span>
          </button>
        </div>

        {isPushSupported() ? (
          <div className="mt-5 rounded-2xl border border-ink/10 px-4 py-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-ink dark:text-white">Installed devices</div>
                <div className="text-xs text-slate">Devices that will receive push alerts.</div>
              </div>
              {pushPermission() !== 'denied' && (
                <Button size="md" variant="secondary" loading={pushBusy} onClick={handleEnablePush}>
                  {devices.length ? 'Add this device' : 'Enable push'}
                </Button>
              )}
            </div>
            {pushPermission() === 'denied' && (
              <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
                Notifications are blocked for this site in your browser settings — enable them there to receive push alerts.
              </p>
            )}
            {pushError && <p className="mt-3 text-xs font-medium text-rose-500">{pushError}</p>}
            {devices.length > 0 && (
              <ul className="mt-4 space-y-2">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.03] px-3.5 py-2.5 text-xs dark:bg-white/[0.04]"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-ink dark:text-white">
                      <Smartphone className="size-3.5 shrink-0 text-slate" />
                      <span className="truncate">{describeDevice(d.userAgent)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDevice(d.id, d.endpoint)}
                      aria-label="Remove device"
                      className="shrink-0 rounded-lg p-1 text-slate transition-colors hover:bg-black/5 hover:text-rose-500 dark:hover:bg-white/10"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-5 text-xs text-slate">Push notifications aren't supported in this browser.</p>
        )}
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

function describeDevice(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS device';
  if (/android/i.test(userAgent)) return 'Android device';
  if (/macintosh/i.test(userAgent)) return 'Mac';
  if (/windows/i.test(userAgent)) return 'Windows PC';
  return 'Browser';
}
