import type { Database } from 'sql.js';
import type { Db } from './types';

/** Db adapter over an in-memory sql.js database (browser mode and tests). */
export function createSqlJsDb(raw: Database, onChange?: () => void): Db {
  return {
    async execute(sql, params = []) {
      raw.run(sql, params);
      const rowsAffected = raw.getRowsModified();
      const res = raw.exec('SELECT last_insert_rowid()');
      const lastInsertId = Number(res[0]?.values[0]?.[0] ?? 0);
      onChange?.();
      return { rowsAffected, lastInsertId };
    },
    async select<T>(sql: string, params: (string | number | null)[] = []) {
      const stmt = raw.prepare(sql);
      try {
        stmt.bind(params);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async batch(statements) {
      raw.run('BEGIN');
      try {
        for (const s of statements) raw.run(s.sql, s.params ?? []);
        raw.run('COMMIT');
      } catch (e) {
        raw.run('ROLLBACK');
        throw e;
      }
      onChange?.();
    },
  };
}
