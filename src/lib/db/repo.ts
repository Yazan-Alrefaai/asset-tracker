import type { Db, SqlValue, Statement } from './types';
import type {
  Alert,
  AlertCondition,
  Asset,
  AssetType,
  CashFlow,
  MetalForm,
  NewAlert,
  NewAsset,
  NewCashFlow,
  NewNotice,
  Notice,
  NoticeData,
  NewTx,
  Portfolio,
  PortfolioKind,
  Quote,
  Snapshot,
  Tx,
  TxKind,
} from '../model';

type Row = Record<string, unknown>;

const num = (v: unknown): number => Number(v ?? 0);
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const str = (v: unknown): string => (v == null ? '' : String(v));

export function toPortfolio(r: Row): Portfolio {
  return { id: num(r.id), name: str(r.name), kind: str(r.kind) as PortfolioKind, sortOrder: num(r.sort_order) };
}

export function toAsset(r: Row): Asset {
  return {
    id: num(r.id),
    portfolioId: num(r.portfolio_id),
    type: str(r.type) as AssetType,
    name: str(r.name),
    symbol: str(r.symbol),
    unit: str(r.unit) || 'unit',
    unitGrams: numOrNull(r.unit_grams),
    purity: numOrNull(r.purity),
    form: str(r.form) as MetalForm,
    priceCurrency: r.price_currency == null ? null : str(r.price_currency),
    manualPrice: numOrNull(r.manual_price),
    useManualPrice: num(r.use_manual_price) === 1,
    location: str(r.location),
    notes: str(r.notes),
    archived: num(r.archived) === 1,
    createdAt: str(r.created_at),
  };
}

export function toTx(r: Row): Tx {
  return {
    id: num(r.id),
    assetId: num(r.asset_id),
    kind: str(r.kind) as TxKind,
    date: str(r.date),
    quantity: num(r.quantity),
    price: num(r.price),
    currency: str(r.currency),
    fees: num(r.fees),
    usdRate: num(r.usd_rate) || 1,
    sypRate: numOrNull(r.syp_rate),
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}

export function toQuote(r: Row): Quote {
  let extra: Record<string, unknown> | null = null;
  if (r.extra) {
    try {
      extra = JSON.parse(str(r.extra));
    } catch {
      extra = null;
    }
  }
  return {
    key: str(r.key),
    price: num(r.price),
    bid: numOrNull(r.bid),
    ask: numOrNull(r.ask),
    currency: str(r.currency),
    source: str(r.source),
    asOf: r.as_of == null ? null : str(r.as_of),
    fetchedAt: str(r.fetched_at),
    extra,
  };
}

export function toSnapshot(r: Row): Snapshot {
  return {
    date: str(r.date),
    portfolioId: num(r.portfolio_id),
    valueUsd: num(r.value_usd),
    costUsd: num(r.cost_usd),
    valueSyp: numOrNull(r.value_syp),
    costSyp: numOrNull(r.cost_syp),
    realizedUsd: numOrNull(r.realized_usd),
    realizedSyp: numOrNull(r.realized_syp),
  };
}

export function toAlert(r: Row): Alert {
  return {
    id: num(r.id),
    target: str(r.target),
    condition: str(r.condition) as AlertCondition,
    value: num(r.value),
    repeat: num(r.repeat) === 1,
    active: num(r.active) === 1,
    state: str(r.state) === 'fired' ? 'fired' : 'armed',
    note: str(r.note),
    lastTriggeredAt: r.last_triggered_at == null ? null : str(r.last_triggered_at),
    lastValue: numOrNull(r.last_value),
    createdAt: str(r.created_at),
  };
}

export function toCashFlow(r: Row): CashFlow {
  return {
    id: num(r.id),
    portfolioId: num(r.portfolio_id),
    kind: str(r.kind) === 'income' ? 'income' : 'expense',
    date: str(r.date),
    amount: num(r.amount),
    currency: str(r.currency),
    category: str(r.category) || 'other',
    usdRate: num(r.usd_rate) || 1,
    sypRate: numOrNull(r.syp_rate),
    note: str(r.note),
    createdAt: str(r.created_at),
  };
}

function parseNoticeData(v: unknown): NoticeData | null {
  if (typeof v !== 'string' || !v) return null;
  try {
    const d = JSON.parse(v) as NoticeData;
    return d && (d.type === 'price' || d.type === 'budget') ? d : null;
  } catch {
    return null;
  }
}

export function toNotice(r: Row): Notice {
  return {
    id: num(r.id),
    kind: str(r.kind) === 'budget' ? 'budget' : 'price',
    title: str(r.title),
    body: str(r.body),
    refId: numOrNull(r.ref_id),
    data: parseNoticeData(r.data),
    read: num(r.read) === 1,
    createdAt: str(r.created_at),
  };
}

export interface AllData {
  portfolios: Portfolio[];
  assets: Asset[];
  txs: Tx[];
  quotes: Quote[];
  settingsRows: { key: string; value: string }[];
  snapshots: Snapshot[];
  alerts: Alert[];
  cashflows: CashFlow[];
  notices: Notice[];
}

export async function loadAll(db: Db): Promise<AllData> {
  const portfolios = await db.select('SELECT * FROM portfolios ORDER BY sort_order, id');
  const assets = await db.select('SELECT * FROM assets ORDER BY id');
  const txs = await db.select('SELECT * FROM transactions ORDER BY date, id');
  const quotes = await db.select('SELECT * FROM quotes');
  const settingsRows = await db.select<{ key: string; value: string }>('SELECT key, value FROM settings');
  const snapshots = await db.select('SELECT * FROM snapshots ORDER BY date');
  const alerts = await db.select('SELECT * FROM alerts ORDER BY id');
  const cashflows = await db.select('SELECT * FROM cashflows ORDER BY date, id');
  const notices = await loadNoticeRows(db);
  return {
    portfolios: portfolios.map(toPortfolio),
    assets: assets.map(toAsset),
    txs: txs.map(toTx),
    quotes: quotes.map(toQuote),
    settingsRows,
    snapshots: snapshots.map(toSnapshot),
    alerts: alerts.map(toAlert),
    cashflows: cashflows.map(toCashFlow),
    notices,
  };
}

// ---------- alerts ----------

export async function insertAlert(db: Db, a: NewAlert): Promise<number> {
  const r = await db.execute('INSERT INTO alerts (target, condition, value, repeat, note) VALUES (?, ?, ?, ?, ?)', [
    a.target,
    a.condition,
    a.value,
    a.repeat ? 1 : 0,
    a.note,
  ]);
  return r.lastInsertId;
}

/** Editing an alert re-arms and re-activates it. */
export async function updateAlert(db: Db, id: number, a: NewAlert): Promise<void> {
  await db.execute(
    `UPDATE alerts SET target = ?, condition = ?, value = ?, repeat = ?, note = ?, active = 1, state = 'armed' WHERE id = ?`,
    [a.target, a.condition, a.value, a.repeat ? 1 : 0, a.note, id],
  );
}

export async function setAlertActive(db: Db, id: number, active: boolean): Promise<void> {
  await db.execute(`UPDATE alerts SET active = ?, state = 'armed' WHERE id = ?`, [active ? 1 : 0, id]);
}

export async function deleteAlert(db: Db, id: number): Promise<void> {
  await db.execute('DELETE FROM alerts WHERE id = ?', [id]);
}

export function alertStateUpdate(a: Pick<Alert, 'id' | 'active' | 'state' | 'lastTriggeredAt' | 'lastValue'>): Statement {
  return {
    sql: 'UPDATE alerts SET active = ?, state = ?, last_triggered_at = ?, last_value = ? WHERE id = ?',
    params: [a.active ? 1 : 0, a.state, a.lastTriggeredAt, a.lastValue, a.id],
  };
}

// ---------- widget windows (one settings row each, so windows never overwrite each other) ----------

export const WIDGET_KEY_PREFIX = 'widget:';

export async function loadWidgetRows(db: Db): Promise<{ key: string; value: string }[]> {
  return db.select<{ key: string; value: string }>(`SELECT key, value FROM settings WHERE key LIKE 'widget:%'`);
}

export async function deleteSetting(db: Db, key: string): Promise<void> {
  await db.execute('DELETE FROM settings WHERE key = ?', [key]);
}

// ---------- portfolios ----------

export async function insertPortfolio(db: Db, p: Omit<Portfolio, 'id'>): Promise<number> {
  const r = await db.execute('INSERT INTO portfolios (name, kind, sort_order) VALUES (?, ?, ?)', [
    p.name,
    p.kind,
    p.sortOrder,
  ]);
  return r.lastInsertId;
}

export async function updatePortfolio(db: Db, p: Portfolio): Promise<void> {
  await db.execute('UPDATE portfolios SET name = ?, kind = ?, sort_order = ? WHERE id = ?', [
    p.name,
    p.kind,
    p.sortOrder,
    p.id,
  ]);
}

export async function deletePortfolio(db: Db, id: number): Promise<void> {
  await db.batch([
    { sql: 'DELETE FROM transactions WHERE asset_id IN (SELECT id FROM assets WHERE portfolio_id = ?)', params: [id] },
    { sql: 'DELETE FROM assets WHERE portfolio_id = ?', params: [id] },
    { sql: 'DELETE FROM snapshots WHERE portfolio_id = ?', params: [id] },
    { sql: 'DELETE FROM cashflows WHERE portfolio_id = ?', params: [id] },
    { sql: 'DELETE FROM portfolios WHERE id = ?', params: [id] },
  ]);
}

// ---------- assets ----------

const ASSET_COLS = [
  'portfolio_id',
  'type',
  'name',
  'symbol',
  'unit',
  'unit_grams',
  'purity',
  'form',
  'price_currency',
  'manual_price',
  'use_manual_price',
  'location',
  'notes',
  'archived',
] as const;

function assetValues(a: NewAsset): SqlValue[] {
  return [
    a.portfolioId,
    a.type,
    a.name,
    a.symbol,
    a.unit,
    a.unitGrams,
    a.purity,
    a.form,
    a.priceCurrency,
    a.manualPrice,
    a.useManualPrice ? 1 : 0,
    a.location,
    a.notes,
    a.archived ? 1 : 0,
  ];
}

export async function insertAsset(db: Db, a: NewAsset): Promise<number> {
  const r = await db.execute(
    `INSERT INTO assets (${ASSET_COLS.join(', ')}) VALUES (${ASSET_COLS.map(() => '?').join(', ')})`,
    assetValues(a),
  );
  return r.lastInsertId;
}

export async function updateAsset(db: Db, id: number, a: NewAsset): Promise<void> {
  await db.execute(`UPDATE assets SET ${ASSET_COLS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...assetValues(a),
    id,
  ]);
}

export async function deleteAsset(db: Db, id: number): Promise<void> {
  await db.batch([
    { sql: 'DELETE FROM transactions WHERE asset_id = ?', params: [id] },
    { sql: 'DELETE FROM assets WHERE id = ?', params: [id] },
  ]);
}

// ---------- transactions ----------

const TX_COLS = ['asset_id', 'kind', 'date', 'quantity', 'price', 'currency', 'fees', 'usd_rate', 'syp_rate', 'notes'] as const;

function txValues(t: NewTx): SqlValue[] {
  return [t.assetId, t.kind, t.date, t.quantity, t.price, t.currency, t.fees, t.usdRate, t.sypRate, t.notes];
}

export async function insertTx(db: Db, t: NewTx): Promise<number> {
  const r = await db.execute(
    `INSERT INTO transactions (${TX_COLS.join(', ')}) VALUES (${TX_COLS.map(() => '?').join(', ')})`,
    txValues(t),
  );
  return r.lastInsertId;
}

export async function updateTx(db: Db, id: number, t: NewTx): Promise<void> {
  await db.execute(`UPDATE transactions SET ${TX_COLS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...txValues(t),
    id,
  ]);
}

export async function deleteTx(db: Db, id: number): Promise<void> {
  await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

// ---------- income & expenses ----------

const FLOW_COLS = ['portfolio_id', 'kind', 'date', 'amount', 'currency', 'category', 'usd_rate', 'syp_rate', 'note'] as const;

function flowValues(f: NewCashFlow): SqlValue[] {
  return [f.portfolioId, f.kind, f.date, f.amount, f.currency, f.category, f.usdRate, f.sypRate, f.note];
}

export async function insertCashFlow(db: Db, f: NewCashFlow): Promise<number> {
  const r = await db.execute(
    `INSERT INTO cashflows (${FLOW_COLS.join(', ')}) VALUES (${FLOW_COLS.map(() => '?').join(', ')})`,
    flowValues(f),
  );
  return r.lastInsertId;
}

export async function updateCashFlow(db: Db, id: number, f: NewCashFlow): Promise<void> {
  await db.execute(`UPDATE cashflows SET ${FLOW_COLS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...flowValues(f),
    id,
  ]);
}

export async function deleteCashFlow(db: Db, id: number): Promise<void> {
  await db.execute('DELETE FROM cashflows WHERE id = ?', [id]);
}

// ---------- notification history ----------

/** How many notifications are kept (oldest are removed). */
export const NOTICE_LIMIT = 200;

export async function loadNoticeRows(db: Db): Promise<Notice[]> {
  const rows = await db.select(`SELECT * FROM notifications ORDER BY id DESC LIMIT ${NOTICE_LIMIT}`);
  return rows.map(toNotice);
}

export async function insertNotice(db: Db, n: NewNotice): Promise<void> {
  await db.batch([
    {
      sql: 'INSERT INTO notifications (kind, title, body, ref_id, data) VALUES (?, ?, ?, ?, ?)',
      params: [n.kind, n.title, n.body, n.refId, n.data ? JSON.stringify(n.data) : null],
    },
    {
      sql: `DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY id DESC LIMIT ${NOTICE_LIMIT})`,
    },
  ]);
}

export async function markNoticesRead(db: Db): Promise<void> {
  await db.execute('UPDATE notifications SET read = 1 WHERE read = 0');
}

export async function clearNotices(db: Db): Promise<void> {
  await db.execute('DELETE FROM notifications');
}

// ---------- quotes, settings, snapshots ----------

export function quoteUpsert(q: Quote): Statement {
  return {
    sql: `INSERT INTO quotes (key, price, bid, ask, currency, source, as_of, fetched_at, extra)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET price = excluded.price, bid = excluded.bid, ask = excluded.ask,
            currency = excluded.currency, source = excluded.source, as_of = excluded.as_of,
            fetched_at = excluded.fetched_at, extra = excluded.extra`,
    params: [
      q.key,
      q.price,
      q.bid,
      q.ask,
      q.currency,
      q.source,
      q.asOf,
      q.fetchedAt,
      q.extra ? JSON.stringify(q.extra) : null,
    ],
  };
}

export async function upsertQuotes(db: Db, quotes: Quote[]): Promise<void> {
  if (quotes.length) await db.batch(quotes.map(quoteUpsert));
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

export function snapshotUpsert(s: Snapshot): Statement {
  return {
    sql: `INSERT INTO snapshots (date, portfolio_id, value_usd, cost_usd, value_syp, cost_syp, realized_usd, realized_syp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(date, portfolio_id) DO UPDATE SET value_usd = excluded.value_usd,
            cost_usd = excluded.cost_usd, value_syp = excluded.value_syp, cost_syp = excluded.cost_syp,
            realized_usd = excluded.realized_usd, realized_syp = excluded.realized_syp`,
    params: [
      s.date,
      s.portfolioId,
      s.valueUsd,
      s.costUsd,
      s.valueSyp ?? null,
      s.costSyp ?? null,
      s.realizedUsd ?? null,
      s.realizedSyp ?? null,
    ],
  };
}

export async function upsertSnapshots(db: Db, snaps: Snapshot[]): Promise<void> {
  if (snaps.length) await db.batch(snaps.map(snapshotUpsert));
}
