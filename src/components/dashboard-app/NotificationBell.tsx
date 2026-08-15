import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  ShieldAlert,
  Gauge,
  Lightbulb,
  WifiOff,
  Wifi,
  FileWarning,
  FileCheck,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../lib/firebaseClient';
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification, type NotificationType } from '../../lib/notifications';

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  critical_alert: AlertTriangle,
  weekly_report: FileText,
  health_improved: TrendingUp,
  health_declined: TrendingDown,
  competitor_activity: Users,
  security_warning: ShieldAlert,
  performance_drop: Gauge,
  content_recommendation: Lightbulb,
  site_down: WifiOff,
  site_recovered: Wifi,
  content_issue: FileWarning,
  content_recovered: FileCheck,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  critical_alert: 'bg-rose-500/10 text-rose-500',
  weekly_report: 'bg-brand-500/10 text-brand-500',
  health_improved: 'bg-mint-500/10 text-mint-600',
  health_declined: 'bg-amber-500/10 text-amber-600',
  competitor_activity: 'bg-violet-500/10 text-violet-500',
  security_warning: 'bg-rose-500/10 text-rose-500',
  performance_drop: 'bg-amber-500/10 text-amber-600',
  content_recommendation: 'bg-brand-500/10 text-brand-500',
  site_down: 'bg-rose-500/10 text-rose-500',
  site_recovered: 'bg-mint-500/10 text-mint-600',
  content_issue: 'bg-rose-500/10 text-rose-500',
  content_recovered: 'bg-mint-500/10 text-mint-600',
};

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.uid, setNotifications);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) return null;

  const unread = notifications.filter((n) => !n.read);

  function handleOpen(notification: AppNotification) {
    if (!user) return;
    if (!notification.read) markNotificationRead(user.uid, notification.id);
    setOpen(false);
    window.location.href = notification.url;
  }

  function handleMarkAllRead() {
    if (!user) return;
    markAllNotificationsRead(
      user.uid,
      notifications.filter((n) => !n.read).map((n) => n.id),
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
      >
        <Bell className="size-4.5" />
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 inline-flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="glass-strong fixed inset-x-4 top-16 z-50 overflow-hidden rounded-2xl shadow-[0_24px_48px_-16px_rgba(0,0,0,0.35)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]"
          >
            <div className="flex items-center justify-between border-b border-ink/[0.06] px-4 py-3 dark:border-white/10">
              <span className="text-sm font-bold text-ink dark:text-white">Notifications</span>
              {unread.length > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold text-brand-500 hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate">You're all caught up. No notifications yet.</div>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleOpen(n)}
                      className={`flex w-full items-start gap-3 border-b border-ink/[0.04] px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-black/[0.02] dark:border-white/[0.04] dark:hover:bg-white/[0.03] ${!n.read ? 'bg-brand-500/[0.04]' : ''}`}
                    >
                      <span className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl ${TYPE_COLOR[n.type] ?? 'bg-slate/10 text-slate'}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink dark:text-white">{n.title}</span>
                          {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{timeAgo(n.createdAt?.toDate() ?? null)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
