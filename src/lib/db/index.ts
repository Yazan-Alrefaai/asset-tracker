import { isTauri } from '../platform';
import type { Db } from './types';

export type { Db, SqlValue, Statement } from './types';

let dbPromise: Promise<Db> | null = null;

/** The app database: SQLite file via Rust in the desktop app, sql.js + localStorage in a browser tab. */
export function getDb(): Promise<Db> {
  dbPromise ??= isTauri ? openTauriDb() : openBrowserDb();
  return dbPromise;
}

async function openTauriDb(): Promise<Db> {
  const { invoke } = await import('@tauri-apps/api/core');
  return {
    execute: (sql, params = []) => invoke('db_execute', { sql, params }),
    select: (sql, params = []) => invoke('db_select', { sql, params }),
    batch: (statements) =>
      invoke('db_batch', { statements: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) }),
  };
}

const BROWSER_KEY = 'asset-tracker:browser-db';

async function openBrowserDb(): Promise<Db> {
  const [{ default: initSqlJs }, { default: wasmUrl }, { createSqlJsDb }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
    import('./sqljs'),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = loadBytes();
  const raw = saved ? new SQL.Database(saved) : new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      saveBytes(raw.export());
      raw.run('PRAGMA foreign_keys = ON'); // export() resets pragmas
    }, 300);
  };
  return createSqlJsDb(raw, persist);
}

function loadBytes(): Uint8Array | null {
  try {
    const b64 = localStorage.getItem(BROWSER_KEY);
    if (!b64) return null;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function saveBytes(bytes: Uint8Array): void {
  try {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    localStorage.setItem(BROWSER_KEY, btoa(bin));
  } catch {
    /* storage full or unavailable: browser mode is only a demo */
  }
}
