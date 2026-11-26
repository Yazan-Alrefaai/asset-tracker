import type { Db, SqlValue, Statement } from './types';
import type {
  Asset,
  AssetType,
  MetalForm,
  NewAsset,
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
  };
}

export interface AllData {
  portfolios: Portfolio[];
  assets: Asset[];
  txs: Tx[];
  quotes: Quote[];
  settingsRows: { key: string; value: string }[];
  snapshots: Snapshot[];
}

export async function loadAll(db: Db): Promise<AllData> {
  const portfolios = await db.select('SELECT * FROM portfolios ORDER BY sort_order, id');
  const assets = await db.select('SELECT * FROM assets ORDER BY id');
  const txs = await db.select('SELECT * FROM transactions ORDER BY date, id');
  const quotes = await db.select('SELECT * FROM quotes');
  const settingsRows = await db.select<{ key: string; value: string }>('SELECT key, value FROM settings');
  const snapshots = await db.select('SELECT * FROM snapshots ORDER BY date');
  return {
    portfolios: portfolios.map(toPortfolio),
    assets: assets.map(toAsset),
    txs: txs.map(toTx),
    quotes: quotes.map(toQuote),
    settingsRows,
    snapshots: snapshots.map(toSnapshot),
  };
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
    sql: `INSERT INTO snapshots (date, portfolio_id, value_usd, cost_usd, value_syp) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(date, portfolio_id) DO UPDATE SET value_usd = excluded.value_usd,
            cost_usd = excluded.cost_usd, value_syp = excluded.value_syp`,
    params: [s.date, s.portfolioId, s.valueUsd, s.costUsd, s.valueSyp],
  };
}

export async function upsertSnapshots(db: Db, snaps: Snapshot[]): Promise<void> {
  if (snaps.length) await db.batch(snaps.map(snapshotUpsert));
}
