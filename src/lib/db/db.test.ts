import initSqlJs from 'sql.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { cashflowsCsv, makeBackup, parseBackup, restoreBackup, transactionsCsv } from '../backup';
import type { NewCashFlow } from '../model';
import { DEFAULT_SETTINGS } from '../settings';
import { MIGRATIONS, migrate } from './migrations';
import * as repo from './repo';
import { createSqlJsDb } from './sqljs';
import type { Db } from './types';

const salary: NewCashFlow = {
  portfolioId: 1,
  kind: 'income',
  date: '2026-11-01',
  amount: 900,
  currency: 'USD',
  category: 'salary',
  usdRate: 1,
  sypRate: 153,
  note: 'November',
};

async function freshDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON');
  return createSqlJsDb(raw);
}

describe('database', () => {
  let db: Db;
  beforeEach(async () => {
    db = await freshDb();
    await migrate(db);
  });

  it('creates the schema once and seeds personal + business portfolios', async () => {
    await migrate(db); // running again must be a no-op
    const all = await repo.loadAll(db);
    expect(all.portfolios.map((p) => p.kind)).toEqual(['personal', 'business']);
    const [{ user_version }] = await db.select<{ user_version: number }>('PRAGMA user_version');
    expect(user_version).toBe(MIGRATIONS.length);
    expect(all.alerts).toEqual([]);
  });

  it('upgrades a version-1 database to the latest version without losing data', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    raw.run('PRAGMA foreign_keys = ON');
    const old = createSqlJsDb(raw);
    // Build exactly what app v0.1 created, then add some data.
    await old.batch([...MIGRATIONS[0].map((sql) => ({ sql })), { sql: 'PRAGMA user_version = 1' }]);
    await old.execute(`INSERT INTO assets (portfolio_id, type, name, symbol) VALUES (1, 'cash', 'Dollars', 'USD')`);
    await old.execute(
      `INSERT INTO transactions (asset_id, kind, date, quantity, price, currency, usd_rate) VALUES (1, 'buy', '2026-11-01', 100, 1, 'USD', 1)`,
    );
    await migrate(old);
    const all = await repo.loadAll(old);
    expect(all.assets).toHaveLength(1);
    expect(all.txs[0].quantity).toBe(100);
    expect(all.alerts).toEqual([]);
    const [{ user_version }] = await old.select<{ user_version: number }>('PRAGMA user_version');
    expect(user_version).toBe(MIGRATIONS.length);
  });

  it('saves, edits, pauses and deletes alerts', async () => {
    const id = await repo.insertAlert(db, { target: 'metal:XAU', condition: 'above', value: 3600, repeat: false, note: 'gold' });
    let [a] = (await repo.loadAll(db)).alerts;
    expect(a).toMatchObject({ id, target: 'metal:XAU', condition: 'above', value: 3600, repeat: false, active: true, state: 'armed', note: 'gold' });

    await db.batch([repo.alertStateUpdate({ id, active: false, state: 'fired', lastTriggeredAt: '2026-11-26T10:00:00Z', lastValue: 3610 })]);
    [a] = (await repo.loadAll(db)).alerts;
    expect(a).toMatchObject({ active: false, state: 'fired', lastTriggeredAt: '2026-11-26T10:00:00Z', lastValue: 3610 });

    await repo.updateAlert(db, id, { target: 'metal:XAU', condition: 'below', value: 3400, repeat: true, note: '' });
    [a] = (await repo.loadAll(db)).alerts;
    expect(a).toMatchObject({ condition: 'below', value: 3400, repeat: true, active: true, state: 'armed' });

    await repo.setAlertActive(db, id, false);
    expect((await repo.loadAll(db)).alerts[0].active).toBe(false);

    await repo.deleteAlert(db, id);
    expect((await repo.loadAll(db)).alerts).toEqual([]);
  });

  it('rejects impossible alerts at the database level', async () => {
    await expect(repo.insertAlert(db, { target: 'metal:XAU', condition: 'above', value: 0, repeat: false, note: '' })).rejects.toThrow();
  });

  it('keeps widget window settings apart from normal settings', async () => {
    await repo.setSetting(db, 'widget:widget-prices', { label: 'widget-prices', kind: 'prices', ref: 0, open: true, onTop: true });
    await repo.setSetting(db, 'language', 'en');
    expect((await repo.loadWidgetRows(db)).map((r) => r.key)).toEqual(['widget:widget-prices']);
    await repo.deleteSetting(db, 'widget:widget-prices');
    expect(await repo.loadWidgetRows(db)).toEqual([]);
  });

  it('saves assets and transactions, and deleting an asset removes its transactions', async () => {
    const id = await repo.insertAsset(db, {
      portfolioId: 1,
      type: 'gold',
      name: 'Bracelet',
      symbol: 'XAU',
      unit: 'g',
      unitGrams: 1,
      purity: 0.875,
      form: 'jewelry',
      priceCurrency: null,
      manualPrice: null,
      useManualPrice: false,
      location: 'home',
      notes: '',
      archived: false,
    });
    await repo.insertTx(db, {
      assetId: id,
      kind: 'buy',
      date: '2026-11-01',
      quantity: 10,
      price: 15000,
      currency: 'SYP',
      fees: 50000,
      usdRate: 150,
      sypRate: 150,
      notes: 'خاتم',
    });
    let all = await repo.loadAll(db);
    expect(all.assets[0]).toMatchObject({ name: 'Bracelet', purity: 0.875, useManualPrice: false, location: 'home' });
    expect(all.txs[0]).toMatchObject({ quantity: 10, fees: 50000, sypRate: 150, notes: 'خاتم' });

    await repo.deleteAsset(db, id);
    all = await repo.loadAll(db);
    expect(all.assets).toHaveLength(0);
    expect(all.txs).toHaveLength(0);
  });

  it('upserts quotes and settings', async () => {
    const q = { key: 'metal:XAU', price: 1, bid: null, ask: null, currency: 'USD', source: 's', asOf: null, fetchedAt: 'now', extra: { a: 1 } };
    await repo.upsertQuotes(db, [q]);
    await repo.upsertQuotes(db, [{ ...q, price: 2 }]);
    await repo.setSetting(db, 'language', 'ar');
    const all = await repo.loadAll(db);
    expect(all.quotes).toEqual([{ ...q, price: 2 }]);
    expect(all.settingsRows).toEqual([{ key: 'language', value: '"ar"' }]);
  });

  it('round-trips a backup into a new database', async () => {
    const assetId = await repo.insertAsset(db, {
      portfolioId: 2,
      type: 'cash',
      name: 'Dollars',
      symbol: 'USD',
      unit: 'unit',
      unitGrams: null,
      purity: null,
      form: '',
      priceCurrency: null,
      manualPrice: null,
      useManualPrice: false,
      location: '',
      notes: '',
      archived: false,
    });
    await repo.insertTx(db, { assetId, kind: 'buy', date: '2026-11-20', quantity: 500, price: 152.75, currency: 'SYP', fees: 0, usdRate: 152.75, sypRate: 152.75, notes: '' });
    await repo.insertAlert(db, { target: 'syp:USD', condition: 'above', value: 160, repeat: true, note: 'sell dollars' });
    await repo.insertCashFlow(db, salary);
    await repo.insertCashFlow(db, {
      ...salary,
      portfolioId: 2,
      kind: 'expense',
      category: 'أمبيرات',
      amount: 25_000,
      currency: 'SYP',
      usdRate: 153,
      note: 'مولدة, "تشرين"',
    });
    const all = await repo.loadAll(db);
    const text = JSON.stringify(
      makeBackup({
        portfolios: all.portfolios,
        assets: all.assets,
        txs: all.txs,
        snapshots: all.snapshots,
        alerts: all.alerts,
        cashflows: all.cashflows,
        settings: { ...DEFAULT_SETTINGS, language: 'ar', zakatBasis: 'silver' },
      }),
    );

    const other = await freshDb();
    await migrate(other);
    await repo.insertAlert(other, { target: 'metal:XAU', condition: 'below', value: 1, repeat: false, note: 'old one' });
    await restoreBackup(other, parseBackup(text));
    const restored = await repo.loadAll(other);
    expect(restored.assets).toEqual(all.assets);
    expect(restored.txs).toEqual(all.txs);
    expect(restored.cashflows).toEqual(all.cashflows);
    expect(restored.cashflows).toHaveLength(2);
    expect(restored.alerts.map(({ createdAt: _c, ...rest }) => rest)).toEqual(all.alerts.map(({ createdAt: _c, ...rest }) => rest));
    expect(restored.settingsRows.find((r) => r.key === 'language')?.value).toBe('"ar"');
    expect(restored.settingsRows.find((r) => r.key === 'zakatBasis')?.value).toBe('"silver"');

    const csv = transactionsCsv({ portfolios: restored.portfolios, assets: restored.assets, txs: restored.txs }, (p) => p.kind);
    expect(csv.startsWith('﻿date,portfolio,asset')).toBe(true);
    expect(csv).toContain('2026-11-20,business,Dollars,cash,USD,buy,500,unit,152.75,SYP');

    const flowsCsv = cashflowsCsv({ portfolios: restored.portfolios, cashflows: restored.cashflows }, (p) => p.kind);
    const lines = flowsCsv.split('\r\n');
    expect(lines[0]).toBe('\ufeffdate,portfolio,kind,category,amount,currency,usd_rate,syp_rate,amount_usd,amount_syp,note');
    expect(lines[1]).toBe('2026-11-01,personal,income,salary,900,USD,1,153,900,137700,November');
    // Commas and quotes in a note are escaped; SYP amounts stay exact.
    expect(lines[2]).toBe('2026-11-01,business,expense,أمبيرات,25000,SYP,153,153,163.4,25000,"مولدة, ""تشرين"""');
  });

  it('rejects files that are not backups, or from a newer app version', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'asset-tracker', format: 99, portfolios: [], assets: [], transactions: [] }))).toThrow();
  });

  it('imports an old v0.1 backup that has no alerts', async () => {
    const v1 = {
      app: 'asset-tracker',
      format: 1,
      exportedAt: '2026-11-26T00:00:00Z',
      portfolios: [{ id: 1, name: '', kind: 'personal', sortOrder: 0 }],
      assets: [],
      transactions: [],
      snapshots: [],
      settings: { language: 'en' },
    };
    const b = parseBackup(JSON.stringify(v1));
    expect(b.alerts).toEqual([]);
    await restoreBackup(db, b);
    const all = await repo.loadAll(db);
    expect(all.portfolios).toHaveLength(1);
    expect(all.alerts).toEqual([]);
  });

  it('upgrades a version-2 database (app 0.2) to income & expenses without losing data', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    raw.run('PRAGMA foreign_keys = ON');
    const old = createSqlJsDb(raw);
    await old.batch([
      ...MIGRATIONS[0].map((sql) => ({ sql })),
      ...MIGRATIONS[1].map((sql) => ({ sql })),
      { sql: 'PRAGMA user_version = 2' },
    ]);
    await old.execute(`INSERT INTO alerts (target, condition, value) VALUES ('metal:XAU', 'above', 4000)`);
    await migrate(old);
    const all = await repo.loadAll(old);
    expect(all.alerts).toHaveLength(1);
    expect(all.cashflows).toEqual([]);
    await repo.insertCashFlow(old, salary);
    expect((await repo.loadAll(old)).cashflows).toHaveLength(1);
  });

  it('saves, edits and deletes income and expenses', async () => {
    const id = await repo.insertCashFlow(db, salary);
    let [f] = (await repo.loadAll(db)).cashflows;
    expect(f).toMatchObject({ id, ...salary });
    expect(f.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await repo.updateCashFlow(db, id, { ...salary, kind: 'expense', category: 'food', amount: 42.5, sypRate: null, note: '' });
    [f] = (await repo.loadAll(db)).cashflows;
    expect(f).toMatchObject({ kind: 'expense', category: 'food', amount: 42.5, sypRate: null, note: '' });

    await repo.deleteCashFlow(db, id);
    expect((await repo.loadAll(db)).cashflows).toEqual([]);
  });

  it('loads income and expenses oldest first', async () => {
    await repo.insertCashFlow(db, { ...salary, date: '2026-11-05' });
    await repo.insertCashFlow(db, { ...salary, date: '2026-10-05' });
    await repo.insertCashFlow(db, { ...salary, date: '2026-11-05', note: 'second' });
    const order = (await repo.loadAll(db)).cashflows.map((f) => `${f.date}/${f.note}`);
    expect(order).toEqual(['2026-10-05/November', '2026-11-05/November', '2026-11-05/second']);
  });

  it('rejects impossible income or expenses at the database level', async () => {
    await expect(repo.insertCashFlow(db, { ...salary, amount: 0 })).rejects.toThrow();
    await expect(repo.insertCashFlow(db, { ...salary, amount: -5 })).rejects.toThrow();
    await expect(repo.insertCashFlow(db, { ...salary, usdRate: 0 })).rejects.toThrow();
    await expect(repo.insertCashFlow(db, { ...salary, kind: 'gift' as never })).rejects.toThrow();
    await expect(repo.insertCashFlow(db, { ...salary, portfolioId: 999 })).rejects.toThrow();
    expect((await repo.loadAll(db)).cashflows).toEqual([]);
  });

  it('deleting a portfolio also deletes its income and expenses', async () => {
    await repo.insertCashFlow(db, salary);
    await repo.insertCashFlow(db, { ...salary, portfolioId: 2 });
    await repo.deletePortfolio(db, 2);
    expect((await repo.loadAll(db)).cashflows.map((f) => f.portfolioId)).toEqual([1]);
  });

  it('imports a v0.2 backup that has no income or expenses, and clears the old ones', async () => {
    await repo.insertCashFlow(db, salary);
    const v2 = {
      app: 'asset-tracker',
      format: 2,
      exportedAt: '2026-11-26T00:00:00Z',
      portfolios: [{ id: 1, name: '', kind: 'personal', sortOrder: 0 }],
      assets: [],
      transactions: [],
      snapshots: [],
      alerts: [],
      settings: {},
    };
    const b = parseBackup(JSON.stringify(v2));
    expect(b.cashflows).toEqual([]);
    await restoreBackup(db, b);
    expect((await repo.loadAll(db)).cashflows).toEqual([]);
  });

  it('upgrades a version-3 database and keeps a capped notification history', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    raw.run('PRAGMA foreign_keys = ON');
    const old = createSqlJsDb(raw);
    await old.batch([...MIGRATIONS.slice(0, 3).flat().map((sql) => ({ sql })), { sql: 'PRAGMA user_version = 3' }]);
    await repo.insertCashFlow(old, salary);
    await migrate(old);
    let all = await repo.loadAll(old);
    expect(all.cashflows).toHaveLength(1);
    expect(all.notices).toEqual([]);

    const data = { type: 'price' as const, target: 'metal:XAU', condition: 'above' as const, line: 3700, value: 3712, note: '' };
    await repo.insertNotice(old, { kind: 'price', title: 'Gold is above $3,700', body: 'Now $3,712', refId: 4, data });
    await repo.insertNotice(old, { kind: 'budget', title: '80% of your budget', body: '', refId: null, data: null });
    all = await repo.loadAll(old);
    expect(all.notices.map((n) => [n.kind, n.title, n.refId, n.read])).toEqual([
      ['budget', '80% of your budget', null, false],
      ['price', 'Gold is above $3,700', 4, false],
    ]);
    expect(all.notices[1].data).toEqual(data);
    expect(all.notices[0].data).toBeNull();
    expect(all.notices[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await repo.markNoticesRead(old);
    expect((await repo.loadAll(old)).notices.every((n) => n.read)).toBe(true);
    await repo.clearNotices(old);
    expect((await repo.loadAll(old)).notices).toEqual([]);
  });

  it('keeps only the newest notifications', async () => {
    for (let i = 1; i <= repo.NOTICE_LIMIT + 5; i++) {
      await repo.insertNotice(db, { kind: 'price', title: `n${i}`, body: '', refId: null, data: null });
    }
    const [{ c }] = await db.select<{ c: number }>('SELECT count(*) AS c FROM notifications');
    expect(c).toBe(repo.NOTICE_LIMIT);
    const { notices } = await repo.loadAll(db);
    expect(notices[0].title).toBe(`n${repo.NOTICE_LIMIT + 5}`);
    expect(notices.at(-1)!.title).toBe('n6');
  });

  it('rejects unknown notification kinds', async () => {
    await expect(repo.insertNotice(db, { kind: 'spam' as never, title: 'x', body: '', refId: null, data: null })).rejects.toThrow();
  });

  it('skips broken income/expense rows in a backup instead of failing the import', async () => {
    const good = { id: 7, ...salary, createdAt: '2026-11-01T10:00:00Z' };
    const text = JSON.stringify({
      app: 'asset-tracker',
      format: 3,
      portfolios: [{ id: 1, name: '', kind: 'personal', sortOrder: 0 }],
      assets: [],
      transactions: [],
      cashflows: [good, { ...good, id: 8, amount: 0 }, { ...good, id: 9, kind: 'x' }, { ...good, id: 10, portfolioId: 5 }, null],
    });
    await restoreBackup(db, parseBackup(text));
    expect((await repo.loadAll(db)).cashflows).toEqual([good]);
  });
});
