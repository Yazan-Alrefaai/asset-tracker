import initSqlJs from 'sql.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, restoreBackup, transactionsCsv } from '../backup';
import { DEFAULT_SETTINGS } from '../settings';
import { MIGRATIONS, migrate } from './migrations';
import * as repo from './repo';
import { createSqlJsDb } from './sqljs';
import type { Db } from './types';

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
    const all = await repo.loadAll(db);
    const text = JSON.stringify(
      makeBackup({
        portfolios: all.portfolios,
        assets: all.assets,
        txs: all.txs,
        snapshots: all.snapshots,
        alerts: all.alerts,
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
    expect(restored.alerts.map(({ createdAt: _c, ...rest }) => rest)).toEqual(all.alerts.map(({ createdAt: _c, ...rest }) => rest));
    expect(restored.settingsRows.find((r) => r.key === 'language')?.value).toBe('"ar"');
    expect(restored.settingsRows.find((r) => r.key === 'zakatBasis')?.value).toBe('"silver"');

    const csv = transactionsCsv({ portfolios: restored.portfolios, assets: restored.assets, txs: restored.txs }, (p) => p.kind);
    expect(csv.startsWith('﻿date,portfolio,asset')).toBe(true);
    expect(csv).toContain('2026-11-20,business,Dollars,cash,USD,buy,500,unit,152.75,SYP');
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
});
