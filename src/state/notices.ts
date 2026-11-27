/** Notification history and the single place that tells the user something (toast + history + system notification). */
import { getDb } from '../lib/db';
import * as repo from '../lib/db/repo';
import type { NewNotice } from '../lib/model';
import { sendSystemNotification } from './notify';
import { announceChange } from './sync';
import { toast, useStore } from './store';

export async function reloadNotices(): Promise<void> {
  useStore.setState({ notices: await repo.loadNoticeRows(await getDb()) });
}

/** Shows a toast, keeps it in the history, and sends a system notification when they are turned on. */
export async function notifyUser(n: NewNotice): Promise<void> {
  toast(n.body ? `${n.title} — ${n.body}` : n.title, 'ok', 12_000);
  try {
    await repo.insertNotice(await getDb(), n);
    await reloadNotices();
    announceChange();
  } catch {
    /* the history is best-effort; the toast and system notification still go out */
  }
  if (useStore.getState().settings.notifications) await sendSystemNotification(n.title, n.body);
}

export async function markAllNoticesRead(): Promise<void> {
  if (!useStore.getState().notices.some((n) => !n.read)) return;
  await repo.markNoticesRead(await getDb());
  await reloadNotices();
  announceChange();
}

export async function clearNoticeHistory(): Promise<void> {
  await repo.clearNotices(await getDb());
  useStore.setState({ notices: [] });
  announceChange();
}
