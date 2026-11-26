/** System notifications: Tauri plugin in the desktop app, the Web Notifications API in a browser tab. */
import { isTauri } from '../lib/platform';

export async function notificationsAllowed(): Promise<boolean> {
  try {
    if (isTauri) {
      const n = await import('@tauri-apps/plugin-notification');
      return await n.isPermissionGranted();
    }
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** Asks the system for permission (shows the macOS/Windows prompt the first time). */
export async function askNotificationPermission(): Promise<boolean> {
  try {
    if (isTauri) {
      const n = await import('@tauri-apps/plugin-notification');
      if (await n.isPermissionGranted()) return true;
      return (await n.requestPermission()) === 'granted';
    }
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export async function sendSystemNotification(title: string, body: string): Promise<boolean> {
  try {
    if (isTauri) {
      const n = await import('@tauri-apps/plugin-notification');
      if (!(await n.isPermissionGranted())) return false;
      n.sendNotification({ title, body });
      return true;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/app-icon.svg' });
      return true;
    }
  } catch {
    /* notifications are best-effort */
  }
  return false;
}
