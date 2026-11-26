/** Price-alert engine (runs in the main window only) and alert CRUD. */
import { MESSAGES } from '../i18n';
import { alertMessage, alertValue, evaluateAlerts } from '../lib/alerts';
import { buildMarket } from '../lib/calc/market';
import { getDb } from '../lib/db';
import * as repo from '../lib/db/repo';
import type { NewAlert } from '../lib/model';
import { totalsOf } from './derived';
import { sendSystemNotification } from './notify';
import { announceChange } from './sync';
import { toast, useStore } from './store';

let timer: ReturnType<typeof setTimeout> | undefined;
let checking = false;

/** Check alerts shortly (prices often arrive in several groups a moment apart). */
export function scheduleAlertCheck(delayMs = 1500): void {
  clearTimeout(timer);
  timer = setTimeout(() => void checkAlerts(), delayMs);
}

/** Evaluates all active alerts against current prices. Returns how many fired. */
export async function checkAlerts(): Promise<number> {
  if (checking) return 0;
  checking = true;
  try {
    const st = useStore.getState();
    const active = st.alerts.filter((a) => a.active);
    if (!active.length) return 0;
    const m = buildMarket(st.quotes, st.settings);
    const totals = active.some((a) => a.target.startsWith('total:')) ? totalsOf(st, m) : { usd: null, syp: null };
    const { fired, changed } = evaluateAlerts(active, (target) => alertValue(target, m, totals));
    if (changed.length) {
      await (await getDb()).batch(changed.map(repo.alertStateUpdate));
      const byId = new Map(changed.map((a) => [a.id, a]));
      useStore.setState((s) => ({ alerts: s.alerts.map((a) => byId.get(a.id) ?? a) }));
      announceChange();
    }
    const t = MESSAGES[st.settings.language];
    for (const f of fired) {
      const msg = alertMessage(f.alert, f.value, m, t, st.settings.language);
      toast(`${msg.title} — ${msg.body}`, 'ok', 12_000);
      if (st.settings.notifications) await sendSystemNotification(msg.title, msg.body);
    }
    return fired.length;
  } finally {
    checking = false;
  }
}

async function reloadAlerts(): Promise<void> {
  const rows = await (await getDb()).select('SELECT * FROM alerts ORDER BY id');
  useStore.setState({ alerts: rows.map(repo.toAlert) });
  announceChange();
}

export async function addAlert(a: NewAlert): Promise<void> {
  await repo.insertAlert(await getDb(), a);
  await reloadAlerts();
  await checkAlerts();
}

export async function editAlert(id: number, a: NewAlert): Promise<void> {
  await repo.updateAlert(await getDb(), id, a);
  await reloadAlerts();
  await checkAlerts();
}

export async function toggleAlert(id: number, active: boolean): Promise<void> {
  await repo.setAlertActive(await getDb(), id, active);
  await reloadAlerts();
  if (active) await checkAlerts();
}

export async function removeAlert(id: number): Promise<void> {
  await repo.deleteAlert(await getDb(), id);
  await reloadAlerts();
}
