import type { Db, Statement } from './db/types';
import { snapshotUpsert } from './db/repo';
import { flowSyp, flowUsd } from './cashflow';
import type { Alert, Asset, CashFlow, Portfolio, Snapshot, Tx } from './model';
import { DEFAULT_SETTINGS, type Settings } from './settings';

export const BACKUP_APP = 'asset-tracker';
/** 1 = v0.1 (no alerts), 2 = v0.2 (adds alerts), 3 = v0.3 (adds income & expenses). Older files can always be imported. */
export const BACKUP_FORMAT = 3;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  portfolios: Portfolio[];
  assets: Asset[];
  transactions: Tx[];
  snapshots: Snapshot[];
  alerts: Alert[];
  cashflows: CashFlow[];
  settings: Partial<Settings>;
}

export function makeBackup(data: {
  portfolios: Portfolio[];
  assets: Asset[];
  txs: Tx[];
  snapshots: Snapshot[];
  alerts: Alert[];
  cashflows?: CashFlow[];
  settings: Settings;
}): BackupFile {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    portfolios: data.portfolios,
    assets: data.assets,
    transactions: data.txs,
    snapshots: data.snapshots,
    alerts: data.alerts,
    cashflows: data.cashflows ?? [],
    settings: data.settings,
  };
}

/** Throws when the text is not a backup made by this app. */
export function parseBackup(text: string): BackupFile {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('invalid');
  }
  const b = j as Partial<BackupFile>;
  if (
    !b ||
    b.app !== BACKUP_APP ||
    !Array.isArray(b.portfolios) ||
    !Array.isArray(b.assets) ||
    !Array.isArray(b.transactions) ||
    (b.format ?? 0) > BACKUP_FORMAT
  ) {
    throw new Error('invalid');
  }
  return {
    app: BACKUP_APP,
    format: b.format ?? BACKUP_FORMAT,
    exportedAt: b.exportedAt ?? '',
    portfolios: b.portfolios,
    assets: b.assets,
    transactions: b.transactions,
    snapshots: Array.isArray(b.snapshots) ? b.snapshots : [],
    alerts: Array.isArray(b.alerts) ? b.alerts : [],
    cashflows: Array.isArray(b.cashflows) ? b.cashflows : [],
    settings: b.settings && typeof b.settings === 'object' ? b.settings : {},
  };
}

/** Replaces all data with the backup, in one transaction (all or nothing). */
export async function restoreBackup(db: Db, b: BackupFile): Promise<void> {
  const st: Statement[] = [
    { sql: 'DELETE FROM transactions' },
    { sql: 'DELETE FROM assets' },
    { sql: 'DELETE FROM snapshots' },
    { sql: 'DELETE FROM cashflows' },
    { sql: 'DELETE FROM portfolios' },
    { sql: 'DELETE FROM alerts' },
  ];
  for (const a of b.alerts) {
    if (!a || !a.target || (a.condition !== 'above' && a.condition !== 'below') || !(a.value > 0)) continue;
    st.push({
      sql: `INSERT INTO alerts (id, target, condition, value, repeat, active, state, note, last_triggered_at, last_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        a.id,
        a.target,
        a.condition,
        a.value,
        a.repeat ? 1 : 0,
        a.active === false ? 0 : 1,
        a.state === 'fired' ? 'fired' : 'armed',
        a.note ?? '',
        a.lastTriggeredAt ?? null,
        a.lastValue ?? null,
      ],
    });
  }
  for (const p of b.portfolios) {
    st.push({
      sql: 'INSERT INTO portfolios (id, name, kind, sort_order) VALUES (?, ?, ?, ?)',
      params: [p.id, p.name ?? '', p.kind ?? 'personal', p.sortOrder ?? 0],
    });
  }
  for (const a of b.assets) {
    st.push({
      sql: `INSERT INTO assets (id, portfolio_id, type, name, symbol, unit, unit_grams, purity, form, price_currency,
              manual_price, use_manual_price, location, notes, archived, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        a.id,
        a.portfolioId,
        a.type,
        a.name ?? '',
        a.symbol ?? '',
        a.unit ?? 'unit',
        a.unitGrams ?? null,
        a.purity ?? null,
        a.form ?? '',
        a.priceCurrency ?? null,
        a.manualPrice ?? null,
        a.useManualPrice ? 1 : 0,
        a.location ?? '',
        a.notes ?? '',
        a.archived ? 1 : 0,
        a.createdAt || new Date().toISOString(),
      ],
    });
  }
  for (const t of b.transactions) {
    st.push({
      sql: `INSERT INTO transactions (id, asset_id, kind, date, quantity, price, currency, fees, usd_rate, syp_rate, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        t.id,
        t.assetId,
        t.kind,
        t.date,
        t.quantity,
        t.price,
        t.currency,
        t.fees ?? 0,
        t.usdRate || 1,
        t.sypRate ?? null,
        t.notes ?? '',
        t.createdAt || new Date().toISOString(),
      ],
    });
  }
  const portfolioIds = new Set(b.portfolios.map((p) => p.id));
  for (const f of b.cashflows) {
    // Skip broken rows instead of failing the whole import.
    if (!f || (f.kind !== 'income' && f.kind !== 'expense') || !(f.amount > 0) || !f.date || !f.currency) continue;
    if (!portfolioIds.has(f.portfolioId)) continue;
    st.push({
      sql: `INSERT INTO cashflows (id, portfolio_id, kind, date, amount, currency, category, usd_rate, syp_rate, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        f.id,
        f.portfolioId,
        f.kind,
        f.date,
        f.amount,
        f.currency,
        f.category || 'other',
        f.usdRate > 0 ? f.usdRate : 1,
        f.sypRate ?? null,
        f.note ?? '',
        f.createdAt || new Date().toISOString(),
      ],
    });
  }
  for (const s of b.snapshots) st.push(snapshotUpsert(s));
  for (const [key, value] of Object.entries(b.settings)) {
    if (key in DEFAULT_SETTINGS && key !== 'lastBackupDate') {
      st.push({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        params: [key, JSON.stringify(value)],
      });
    }
  }
  await db.batch(st);
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** All transactions as CSV (with a BOM so Excel shows Arabic correctly). */
export function transactionsCsv(data: { portfolios: Portfolio[]; assets: Asset[]; txs: Tx[] }, portfolioLabel: (p: Portfolio) => string): string {
  const header = [
    'date',
    'portfolio',
    'asset',
    'asset_type',
    'symbol',
    'kind',
    'quantity',
    'unit',
    'price',
    'currency',
    'fees',
    'usd_rate',
    'syp_rate',
    'notes',
  ];
  const assets = new Map(data.assets.map((a) => [a.id, a]));
  const portfolios = new Map(data.portfolios.map((p) => [p.id, p]));
  const rows = [...data.txs]
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1))
    .map((t) => {
      const a = assets.get(t.assetId);
      const p = a ? portfolios.get(a.portfolioId) : undefined;
      return [
        t.date,
        p ? portfolioLabel(p) : '',
        a?.name ?? '',
        a?.type ?? '',
        a?.symbol ?? '',
        t.kind,
        t.quantity,
        a?.unit ?? '',
        t.price,
        t.currency,
        t.fees,
        t.usdRate,
        t.sypRate ?? '',
        t.notes,
      ]
        .map(csvCell)
        .join(',');
    });
  return '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Income & expenses as CSV, oldest first, with USD/SYP values at each day's rate. */
export function cashflowsCsv(
  data: { portfolios: Portfolio[]; cashflows: CashFlow[] },
  portfolioLabel: (p: Portfolio) => string,
  categoryLabel: (f: CashFlow) => string = (f) => f.category,
): string {
  const header = ['date', 'portfolio', 'kind', 'category', 'amount', 'currency', 'usd_rate', 'syp_rate', 'amount_usd', 'amount_syp', 'note'];
  const portfolios = new Map(data.portfolios.map((p) => [p.id, p]));
  const round = (v: number | null, d: number) => (v == null ? '' : Math.round(v * 10 ** d) / 10 ** d);
  const rows = [...data.cashflows]
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1))
    .map((f) => {
      const p = portfolios.get(f.portfolioId);
      return [
        f.date,
        p ? portfolioLabel(p) : '',
        f.kind,
        categoryLabel(f),
        f.amount,
        f.currency,
        f.usdRate,
        f.sypRate ?? '',
        round(flowUsd(f), 2),
        round(flowSyp(f), 0),
        f.note,
      ]
        .map(csvCell)
        .join(',');
    });
  return '\ufeff' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}
