import initSqlJs from 'sql.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, restoreBackup, transactionsCsv } from '../backup';
import { DEFAULT_SETTINGS } from '../settings';
import { migrate } from './migrations';
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
    expect(user_version).toBe(1);
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
    const all = await repo.loadAll(db);
    const text = JSON.stringify(
      makeBackup({ portfolios: all.portfolios, assets: all.assets, txs: all.txs, snapshots: all.snapshots, settings: { ...DEFAULT_SETTINGS, language: 'ar' } }),
    );

    const other = await freshDb();
    await migrate(other);
    await restoreBackup(other, parseBackup(text));
    const restored = await repo.loadAll(other);
    expect(restored.assets).toEqual(all.assets);
    expect(restored.txs).toEqual(all.txs);
    expect(restored.settingsRows.find((r) => r.key === 'language')?.value).toBe('"ar"');

    const csv = transactionsCsv({ portfolios: restored.portfolios, assets: restored.assets, txs: restored.txs }, (p) => p.kind);
    expect(csv.startsWith('﻿date,portfolio,asset')).toBe(true);
    expect(csv).toContain('2026-11-20,business,Dollars,cash,USD,buy,500,unit,152.75,SYP');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
  });
});
