/** Keeps the menu-bar (macOS) / tray (Windows) text in step with prices, language and privacy. */
import { MESSAGES } from '../i18n';
import { buildMarket } from '../lib/calc/market';
import { isTauri } from '../lib/platform';
import { trayTitle, trayTooltip } from '../lib/tray';
import { totalsOf } from './derived';
import { useStore } from './store';

let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleTrayUpdate(): void {
  if (!isTauri) return;
  clearTimeout(timer);
  timer = setTimeout(() => void updateTray(), 600);
}

async function updateTray(): Promise<void> {
  const st = useStore.getState();
  const s = st.settings;
  const m = buildMarket(st.quotes, s);
  const totals = s.trayItems.includes('total') ? totalsOf(st, m) : { usd: null, syp: null };
  const spy = st.quotes['stock:SPY']?.price ?? null;
  const t = MESSAGES[s.language];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('tray_update', {
      title: trayTitle(s.trayItems, m, totals, { privacy: st.privacy, mainCurrency: s.mainCurrency, spy }),
      tooltip: trayTooltip(s.trayItems, m, totals, t, { privacy: st.privacy, spy }),
      labels: { show: t.tray.show, refresh: t.tray.refresh, quit: t.tray.quit },
    });
  } catch {
    /* tray is optional */
  }
}

/** Re-run the update whenever something the tray shows changes. */
export function watchTray(): void {
  if (!isTauri) return;
  useStore.subscribe((now, before) => {
    if (
      now.quotes !== before.quotes ||
      now.settings !== before.settings ||
      now.privacy !== before.privacy ||
      now.assets !== before.assets ||
      now.txs !== before.txs
    ) {
      scheduleTrayUpdate();
    }
  });
  scheduleTrayUpdate();
}
