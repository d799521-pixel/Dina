// Interface minimale d'une connexion SQLite utilisée par les repositories.
// Implémentée par better-sqlite3 (application de bureau) et par l'adaptateur
// sql.js (version iPad / navigateur) : la logique métier est commune.

export interface Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface DB {
  prepare(sql: string): Statement
  exec(sql: string): unknown
  pragma(source: string, options?: { simple?: boolean }): unknown
  transaction<F extends (...args: any[]) => any>(fn: F): (...args: Parameters<F>) => ReturnType<F>
  close(): unknown
}
