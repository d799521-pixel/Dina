import type { Database as SqlJsDatabase, SqlValue } from 'sql.js'
import type { DB } from '../../../main/db/types'

// Adaptateur : expose sur sql.js (SQLite compilé en WebAssembly) le sous-ensemble
// de l'API better-sqlite3 utilisé par les repositories. Toute la logique métier
// (migrations, validations, requêtes) est ainsi partagée avec l'application de bureau.

type Param = SqlValue | boolean | undefined
type Row = Record<string, SqlValue>

const norm = (params: Param[]): SqlValue[] =>
  params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p))

class Statement {
  constructor(
    private readonly db: SqlJsDatabase,
    private readonly sql: string
  ) {}

  run(...params: Param[]): { changes: number; lastInsertRowid: number } {
    this.db.run(this.sql, norm(params))
    const changes = this.db.getRowsModified()
    const id = this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0]
    return { changes, lastInsertRowid: Number(id ?? 0) }
  }

  get(...params: Param[]): Row | undefined {
    const stmt = this.db.prepare(this.sql)
    try {
      stmt.bind(norm(params))
      return stmt.step() ? (stmt.getAsObject() as Row) : undefined
    } finally {
      stmt.free()
    }
  }

  all(...params: Param[]): Row[] {
    const stmt = this.db.prepare(this.sql)
    try {
      stmt.bind(norm(params))
      const rows: Row[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as Row)
      return rows
    } finally {
      stmt.free()
    }
  }
}

export class SqlJsAdapter {
  private depth = 0

  constructor(readonly raw: SqlJsDatabase) {}

  prepare(sql: string): Statement {
    return new Statement(this.raw, sql)
  }

  exec(sql: string): this {
    this.raw.exec(sql)
    return this
  }

  pragma(source: string, options?: { simple?: boolean }): unknown {
    const rows = this.prepare(`PRAGMA ${source}`).all()
    return options?.simple ? (rows[0] ? Object.values(rows[0])[0] : undefined) : rows
  }

  /** Transactions imbriquables (points de sauvegarde), comme better-sqlite3. */
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      const name = `dina_sp${this.depth++}`
      this.raw.exec(`SAVEPOINT ${name}`)
      try {
        const result = fn(...args)
        this.raw.exec(`RELEASE ${name}`)
        return result
      } catch (err) {
        this.raw.exec(`ROLLBACK TO ${name}; RELEASE ${name}`)
        throw err
      } finally {
        this.depth--
      }
    }
  }

  /** Nombre total de modifications depuis l'ouverture (sert à savoir s'il faut enregistrer). */
  totalChanges(): number {
    return Number(this.raw.exec('SELECT total_changes()')[0].values[0][0])
  }

  export(): Uint8Array {
    return this.raw.export()
  }

  close(): void {
    this.raw.close()
  }

  /** Vue typée « better-sqlite3 » pour les repositories partagés. */
  asDB(): DB {
    return this as unknown as DB
  }
}
