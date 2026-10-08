import type { DB } from '../db/types'
import { ValidationError } from '../validation'

// Format de sauvegarde commun à l'application de bureau et à la version iPad :
// un fichier JSON, éventuellement chiffré (AES-256-GCM, clé dérivée du mot de
// passe par PBKDF2-SHA256), contenant toutes les tables.

export const BACKUP_FORMAT = 'dina-backup'
export const PBKDF2_ITERATIONS = 310_000

export interface BackupPayload {
  schema_version: number
  exported_at: string
  tables: Record<string, Record<string, unknown>[]>
}

export type BackupKdf =
  | { name: 'pbkdf2'; hash: 'SHA-256'; iterations: number; salt: string }
  | { name: 'scrypt'; salt: string; N: number; r: number; p: number }

export type BackupEnvelope =
  | { format: typeof BACKUP_FORMAT; version: 1; encrypted: false; payload: BackupPayload }
  | {
      format: typeof BACKUP_FORMAT
      version: 1
      encrypted: true
      kdf: BackupKdf
      cipher: 'aes-256-gcm'
      iv: string
      tag: string
      data: string // base64(gzip(JSON))
    }

export function assertEnvelope(raw: unknown): BackupEnvelope {
  const env = raw as BackupEnvelope
  if (!env || env.format !== BACKUP_FORMAT || env.version !== 1) throw new ValidationError('Fichier de sauvegarde non reconnu')
  return env
}

/** Tables utilisateur, dans l'ordre de création (= ordre compatible avec les clés étrangères). */
function userTables(db: DB): string[] {
  return (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid`)
      .all() as { name: string }[]
  ).map((r) => r.name)
}

export function createPayload(db: DB): BackupPayload {
  const tables: BackupPayload['tables'] = {}
  for (const t of userTables(db)) tables[t] = db.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[]
  return {
    schema_version: db.pragma('user_version', { simple: true }) as number,
    exported_at: new Date().toISOString(),
    tables
  }
}

/** Remplace intégralement le contenu de la base par celui de la sauvegarde. */
export function restoreBackup(db: DB, payload: BackupPayload): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (payload.schema_version > current) {
    throw new ValidationError('Sauvegarde issue d’une version plus récente de Dina : mettez l’application à jour.')
  }
  const tables = userTables(db)
  db.transaction(() => {
    db.pragma('defer_foreign_keys = ON')
    for (const t of [...tables].reverse()) db.prepare(`DELETE FROM "${t}"`).run()
    for (const t of tables) {
      const rows = payload.tables[t]
      if (!rows?.length) continue
      const columns = new Set((db.prepare(`PRAGMA table_info("${t}")`).all() as { name: string }[]).map((c) => c.name))
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => columns.has(k))
        db.prepare(
          `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
        ).run(...keys.map((k) => row[k]))
      }
    }
  })()
}
