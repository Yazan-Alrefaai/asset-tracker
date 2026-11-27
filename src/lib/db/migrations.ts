import type { Db } from './types';

const NOW = `(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;

/**
 * Schema migrations. Each entry is one version; never edit an entry that has shipped —
 * add a new one instead. The current version is kept in `PRAGMA user_version`.
 */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE portfolios (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal','business','other')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ${NOW}
    )`,
    `CREATE TABLE assets (
      id INTEGER PRIMARY KEY,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('gold','silver','crypto','stock','cash','manual')),
      name TEXT NOT NULL,
      symbol TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'unit',
      unit_grams REAL,
      purity REAL,
      form TEXT NOT NULL DEFAULT '',
      price_currency TEXT,
      manual_price REAL,
      use_manual_price INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ${NOW}
    )`,
    `CREATE INDEX idx_assets_portfolio ON assets(portfolio_id)`,
    `CREATE TABLE transactions (
      id INTEGER PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('buy','sell')),
      date TEXT NOT NULL,
      quantity REAL NOT NULL CHECK (quantity > 0),
      price REAL NOT NULL CHECK (price >= 0),
      currency TEXT NOT NULL,
      fees REAL NOT NULL DEFAULT 0,
      usd_rate REAL NOT NULL DEFAULT 1 CHECK (usd_rate > 0),
      syp_rate REAL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ${NOW}
    )`,
    `CREATE INDEX idx_tx_asset ON transactions(asset_id, date)`,
    `CREATE TABLE quotes (
      key TEXT PRIMARY KEY,
      price REAL NOT NULL,
      bid REAL,
      ask REAL,
      currency TEXT NOT NULL,
      source TEXT NOT NULL,
      as_of TEXT,
      fetched_at TEXT NOT NULL,
      extra TEXT
    )`,
    `CREATE TABLE snapshots (
      date TEXT NOT NULL,
      portfolio_id INTEGER NOT NULL,
      value_usd REAL NOT NULL,
      cost_usd REAL NOT NULL,
      value_syp REAL,
      PRIMARY KEY (date, portfolio_id)
    )`,
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `INSERT INTO portfolios (name, kind, sort_order) VALUES ('', 'personal', 0), ('', 'business', 1)`,
  ],
  // v2 (app 0.2): price alerts
  [
    `CREATE TABLE alerts (
      id INTEGER PRIMARY KEY,
      target TEXT NOT NULL,
      condition TEXT NOT NULL CHECK (condition IN ('above','below')),
      value REAL NOT NULL CHECK (value > 0),
      repeat INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      state TEXT NOT NULL DEFAULT 'armed' CHECK (state IN ('armed','fired')),
      note TEXT NOT NULL DEFAULT '',
      last_triggered_at TEXT,
      last_value REAL,
      created_at TEXT NOT NULL DEFAULT ${NOW}
    )`,
  ],
  // v3 (app 0.3): income & expenses
  [
    `CREATE TABLE cashflows (
      id INTEGER PRIMARY KEY,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
      date TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      usd_rate REAL NOT NULL DEFAULT 1 CHECK (usd_rate > 0),
      syp_rate REAL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ${NOW}
    )`,
    `CREATE INDEX idx_cashflows_date ON cashflows(date)`,
    `CREATE INDEX idx_cashflows_portfolio ON cashflows(portfolio_id, date)`,
  ],
  // v4 (app 0.3): notification history
  [
    `CREATE TABLE notifications (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('price','budget')),
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      ref_id INTEGER,
      data TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ${NOW}
    )`,
  ],
  // v5 (app 0.3): SYP cost and realized profit per daily snapshot, so gains over time leave out
  // money added or taken out, and selling does not look like a loss.
  [
    `ALTER TABLE snapshots ADD COLUMN cost_syp REAL`,
    `ALTER TABLE snapshots ADD COLUMN realized_usd REAL`,
    `ALTER TABLE snapshots ADD COLUMN realized_syp REAL`,
  ],
];

export async function migrate(db: Db): Promise<number> {
  const rows = await db.select<{ user_version: number }>('PRAGMA user_version');
  const current = Number(rows[0]?.user_version ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.batch([
      ...MIGRATIONS[v].map((sql) => ({ sql })),
      { sql: `PRAGMA user_version = ${v + 1}` },
    ]);
  }
  return MIGRATIONS.length;
}
