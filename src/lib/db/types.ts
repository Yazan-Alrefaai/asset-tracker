export type SqlValue = string | number | null;

export interface ExecResult {
  rowsAffected: number;
  lastInsertId: number;
}

export interface Statement {
  sql: string;
  params?: SqlValue[];
}

/** Minimal database interface shared by the desktop app (Rust/SQLite) and browser mode (sql.js). */
export interface Db {
  execute(sql: string, params?: SqlValue[]): Promise<ExecResult>;
  select<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Runs all statements in one transaction. */
  batch(statements: Statement[]): Promise<void>;
}
