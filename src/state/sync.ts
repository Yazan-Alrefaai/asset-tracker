/**
 * Keeps widget windows in step with the main window: the main window announces changes,
 * widgets reload from the database. (Browser tabs have no Tauri events; widgets there reload on a timer.)
 */
import { isTauri } from '../lib/platform';

const EVENT = 'data-changed';
let timer: ReturnType<typeof setTimeout> | undefined;

/** Tell all windows that prices, data or settings changed (batched, at most about once a second). */
export function announceChange(): void {
  if (!isTauri) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit(EVENT);
    } catch {
      /* no listeners is fine */
    }
  }, 800);
}

export async function onChange(cb: () => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen(EVENT, () => cb());
}

export async function onTrayRefresh(cb: () => void): Promise<void> {
  if (!isTauri) return;
  const { listen } = await import('@tauri-apps/api/event');
  await listen('tray-refresh', () => cb());
}
