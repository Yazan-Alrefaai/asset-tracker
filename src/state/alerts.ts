/** Price-alert engine (runs in the main window only) and alert CRUD. */
import { MESSAGES } from '../i18n';
import { alertMessage, alertValue, evaluateAlerts } from '../lib/alerts';
import { buildMarket } from '../lib/calc/market';
import { getDb } from '../lib/db';
import * as repo from '../lib/db/repo';
import type { NewAlert } from '../lib/model';
import { serial } from '../lib/serial';
import { totalsOf } from './derived';
import { notifyUser } from './notices';
import { announceChange } from './sync';
import { useStore } from './store';

let timer: ReturnType<typeof setTimeout> | undefined;

/** Check alerts shortly (prices often arrive in several groups a moment apart). */
export function scheduleAlertCheck(delayMs = 1500): void {
  clearTimeout(timer);
  timer = setTimeout(() => void checkAlerts(), delayMs);
}

/**
 * Evaluates all active alerts against current prices. Returns how many fired.
 * One check at a time; a check asked for during a check runs right after it (never dropped).
 */
export const checkAlerts = serial(async (): Promise<number> => {
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
    await notifyUser({
      kind: 'price',
      title: msg.title,
      body: msg.body,
      refId: f.alert.id,
      data: { type: 'price', target: f.alert.target, condition: f.alert.condition, line: f.alert.value, value: f.value, note: f.alert.note },
    });
  }
  return fired.length;
});

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
