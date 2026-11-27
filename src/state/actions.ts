import { buildMarket } from '../lib/calc/market';
import { computeHolding, summarize, type Holding } from '../lib/calc/portfolio';
import { todayLocal } from '../lib/dates';
import { getDb } from '../lib/db';
import { migrate } from '../lib/db/migrations';
import * as repo from '../lib/db/repo';
import type { NewAsset, NewCashFlow, NewTx, Portfolio, Snapshot } from '../lib/model';
import { isTauri } from '../lib/platform';
import { parseSettings, writeUiCache, type Settings } from '../lib/settings';
import { scheduleAlertCheck } from './alerts';
import { groupTxs } from './derived';
import { refreshPrices, startPriceEngine } from './prices';
import { errorText, type PriceGroup, useStore } from './store';
import { announceChange, onChange, onTrayRefresh } from './sync';
import { watchTray } from './tray';
import { reopenWidgets } from './widgets';

let booting: Promise<void> | null = null;

/** Main window: opens the database, runs migrations, loads everything and starts the engines (once). */
export function boot(): Promise<void> {
  booting ??= doBoot();
  return booting;
}

/** Widget windows: read-only view of the same database, reloaded when the main window announces changes. */
export function bootWidget(): Promise<void> {
  booting ??= doBootWidget();
  return booting;
}

async function loadEverything(): Promise<repo.AllData> {
  const all = await repo.loadAll(await getDb());
  useStore.setState({
    portfolios: all.portfolios,
    assets: all.assets,
    txs: all.txs,
    snapshots: all.snapshots,
    alerts: all.alerts,
    cashflows: all.cashflows,
    quotes: Object.fromEntries(all.quotes.map((q) => [q.key, q])),
  });
  return all;
}

/** Runs after every successful price update. */
function afterPrices(): void {
  scheduleSnapshots();
  scheduleAlertCheck();
  announceChange();
}

async function doBoot(): Promise<void> {
  try {
    await migrate(await getDb());
    const all = await loadEverything();
    const settings = parseSettings(all.settingsRows);
    if (!all.settingsRows.some((r) => r.key === 'language')) {
      // first start: keep the language the UI already shows
      settings.language = useStore.getState().settings.language;
    }
    useStore.setState({ settings, ready: true });
    writeUiCache(settings);
    startPriceEngine(afterPrices);
    scheduleAlertCheck(3000);
    watchTray();
    void syncKeepInTray(settings.keepInTray);
    void onTrayRefresh(() => refreshPrices());
    void reopenWidgets();
    void dailyBackup();
  } catch (e) {
    useStore.setState({ bootError: errorText(e) });
  }
}

async function doBootWidget(): Promise<void> {
  try {
    const all = await loadEverything();
    useStore.setState({ settings: parseSettings(all.settingsRows), ready: true });
    await onChange(async () => {
      const again = await loadEverything();
      useStore.setState({ settings: parseSettings(again.settingsRows) });
    });
    // Browser demo: popups have their own copy of the data, so refresh it now and then.
    if (!isTauri) setInterval(() => window.location.reload(), 60_000);
  } catch (e) {
    useStore.setState({ bootError: errorText(e) });
  }
}

async function syncKeepInTray(value: boolean): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_keep_in_tray', { value });
  } catch {
    /* older builds without the command */
  }
}

export async function reloadData(): Promise<void> {
  const all = await repo.loadAll(await getDb());
  useStore.setState({
    portfolios: all.portfolios,
    assets: all.assets,
    txs: all.txs,
    snapshots: all.snapshots,
    alerts: all.alerts,
    cashflows: all.cashflows,
  });
  scheduleSnapshots();
  scheduleAlertCheck();
  announceChange();
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  await db.batch(
    Object.entries(patch).map(([key, value]) => ({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      params: [key, JSON.stringify(value)],
    })),
  );
  useStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));
  writeUiCache(useStore.getState().settings);
  announceChange();
  if ('keepInTray' in patch) void syncKeepInTray(!!patch.keepInTray);
  if ('sypCity' in patch) refreshPrices(['syp']);
  if ('sypSource' in patch || 'sypManualBuy' in patch || 'metalPricing' in patch) {
    scheduleSnapshots();
    scheduleAlertCheck();
  }
}

// ---------- portfolios ----------

export async function addPortfolio(p: Omit<Portfolio, 'id' | 'sortOrder'>): Promise<number> {
  const sortOrder = Math.max(-1, ...useStore.getState().portfolios.map((x) => x.sortOrder)) + 1;
  const id = await repo.insertPortfolio(await getDb(), { ...p, sortOrder });
  await reloadData();
  return id;
}

export async function editPortfolio(p: Portfolio): Promise<void> {
  await repo.updatePortfolio(await getDb(), p);
  await reloadData();
}

export async function removePortfolio(id: number): Promise<void> {
  await repo.deletePortfolio(await getDb(), id);
  const st = useStore.getState();
  if (st.portfolioFilter === id) useStore.setState({ portfolioFilter: 'all' });
  await reloadData();
}

// ---------- assets & transactions ----------

function refreshFor(type: NewAsset['type']): void {
  const map: Partial<Record<NewAsset['type'], PriceGroup>> = { crypto: 'crypto', stock: 'stocks' };
  const g = map[type];
  if (g) refreshPrices([g]);
}

export async function addAsset(a: NewAsset): Promise<number> {
  const id = await repo.insertAsset(await getDb(), a);
  await reloadData();
  refreshFor(a.type);
  return id;
}

export async function editAsset(id: number, a: NewAsset): Promise<void> {
  await repo.updateAsset(await getDb(), id, a);
  await reloadData();
  refreshFor(a.type);
}

export async function removeAsset(id: number): Promise<void> {
  await repo.deleteAsset(await getDb(), id);
  await reloadData();
}

export async function addTx(t: NewTx): Promise<void> {
  await repo.insertTx(await getDb(), t);
  await reloadData();
}

export async function editTx(id: number, t: NewTx): Promise<void> {
  await repo.updateTx(await getDb(), id, t);
  await reloadData();
}

export async function removeTx(id: number): Promise<void> {
  await repo.deleteTx(await getDb(), id);
  await reloadData();
}

// ---------- income & expenses ----------

export async function addCashFlow(f: NewCashFlow): Promise<number> {
  const id = await repo.insertCashFlow(await getDb(), f);
  await reloadData();
  return id;
}

export async function editCashFlow(id: number, f: NewCashFlow): Promise<void> {
  await repo.updateCashFlow(await getDb(), id, f);
  await reloadData();
}

export async function removeCashFlow(id: number): Promise<void> {
  await repo.deleteCashFlow(await getDb(), id);
  await reloadData();
}

// ---------- daily value history ----------

let snapTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSnapshots(): void {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => void recordSnapshots(), 4000);
}

/** Saves today's value per portfolio (id) and for everything together (id 0). Skipped while prices are missing. */
export async function recordSnapshots(): Promise<void> {
  const st = useStore.getState();
  const m = buildMarket(st.quotes, st.settings);
  const byAsset = groupTxs(st.txs);
  const date = todayLocal();
  const groups = new Map<number, Holding[]>([[0, []]]);
  for (const a of st.assets) {
    if (a.archived) continue;
    const h = computeHolding(a, byAsset.get(a.id) ?? [], m);
    groups.get(0)!.push(h);
    if (!groups.has(a.portfolioId)) groups.set(a.portfolioId, []);
    groups.get(a.portfolioId)!.push(h);
  }
  const snaps: Snapshot[] = [];
  for (const [portfolioId, hs] of groups) {
    const s = summarize(hs);
    if (s.openCount === 0 || s.missing > 0) continue;
    snaps.push({ date, portfolioId, valueUsd: s.valueUsd, costUsd: s.costUsd, valueSyp: s.valueSyp });
  }
  if (!snaps.length) return;
  try {
    await repo.upsertSnapshots(await getDb(), snaps);
    useStore.setState((s) => ({
      snapshots: [
        ...s.snapshots.filter((x) => !(x.date === date && snaps.some((n) => n.portfolioId === x.portfolioId))),
        ...snaps,
      ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    }));
  } catch {
    /* history is best-effort */
  }
}

// ---------- backups ----------

/** Desktop app: one database copy per day in the data folder (last 14 kept). */
async function dailyBackup(): Promise<void> {
  if (!isTauri) return;
  const today = todayLocal();
  if (useStore.getState().settings.lastBackupDate === today) return;
  try {
    await backupNow();
    await saveSettings({ lastBackupDate: today });
  } catch {
    /* not critical */
  }
}

export async function backupNow(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('db_backup', { stamp: todayLocal(), keep: 14 });
}
