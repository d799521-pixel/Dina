import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { DB } from '../db/connection'
import { ValidationError } from '../validation'

const FORMAT = 'dina-backup'
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

interface Payload {
  schema_version: number
  exported_at: string
  tables: Record<string, Record<string, unknown>[]>
}

export type BackupEnvelope =
  | { format: typeof FORMAT; version: 1; encrypted: false; payload: Payload }
  | {
      format: typeof FORMAT
      version: 1
      encrypted: true
      kdf: { name: 'scrypt'; salt: string; N: number; r: number; p: number }
      cipher: 'aes-256-gcm'
      iv: string
      tag: string
      data: string // base64(gzip(JSON))
    }

/** Tables utilisateur, dans l'ordre de création (= ordre compatible avec les clés étrangères). */
function userTables(db: DB): string[] {
  return (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid`)
      .all() as { name: string }[]
  ).map((r) => r.name)
}

export function createBackup(db: DB, passphrase: string | null): BackupEnvelope {
  const tables: Payload['tables'] = {}
  for (const t of userTables(db)) tables[t] = db.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[]
  const payload: Payload = {
    schema_version: db.pragma('user_version', { simple: true }) as number,
    exported_at: new Date().toISOString(),
    tables
  }
  if (!passphrase) return { format: FORMAT, version: 1, encrypted: false, payload }

  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32, SCRYPT)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(gzipSync(JSON.stringify(payload))), cipher.final()])
  return {
    format: FORMAT,
    version: 1,
    encrypted: true,
    kdf: { name: 'scrypt', salt: salt.toString('base64'), N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p },
    cipher: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  }
}

export function readBackup(raw: unknown, passphrase: string | null): Payload {
  const env = raw as BackupEnvelope
  if (!env || env.format !== FORMAT || env.version !== 1) throw new ValidationError('Fichier de sauvegarde non reconnu')
  if (!env.encrypted) return env.payload
  if (!passphrase) throw new ValidationError('Cette sauvegarde est chiffrée : mot de passe requis')
  try {
    const key = scryptSync(passphrase, Buffer.from(env.kdf.salt, 'base64'), 32, {
      N: env.kdf.N,
      r: env.kdf.r,
      p: env.kdf.p,
      maxmem: SCRYPT.maxmem
    })
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(env.tag, 'base64'))
    const zipped = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()])
    return JSON.parse(gunzipSync(zipped).toString('utf8')) as Payload
  } catch {
    throw new ValidationError('Mot de passe incorrect ou sauvegarde corrompue')
  }
}

/** Remplace intégralement le contenu de la base par celui de la sauvegarde. */
export function restoreBackup(db: DB, payload: Payload): void {
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
