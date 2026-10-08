import { openSync, readSync, closeSync, existsSync } from 'node:fs'
import Database from 'better-sqlite3-multiple-ciphers'
import type { Database as BetterDB } from 'better-sqlite3-multiple-ciphers'
import { migrate } from './migrator'
import type { DB } from './types'

export type { DB }

export class WrongPassphraseError extends Error {
  constructor() {
    super('Mot de passe incorrect ou fichier illisible.')
    this.name = 'WrongPassphraseError'
  }
}

const SQLITE_HEADER = 'SQLite format 3\u0000'

/** Une base SQLite en clair commence par un en-tête connu ; une base chiffrée non. */
export function isEncryptedFile(path: string): boolean {
  if (!existsSync(path)) return false
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(16)
    const read = readSync(fd, buf, 0, 16, 0)
    if (read === 0) return false
    return buf.toString('latin1', 0, read) !== SQLITE_HEADER
  } finally {
    closeSync(fd)
  }
}

const quote = (s: string): string => `'${s.replaceAll("'", "''")}'`

/** Chiffrement compatible SQLCipher 4 (AES-256, PBKDF2-HMAC-SHA512 256 000 itérations). */
function applyKey(db: BetterDB, passphrase: string): void {
  db.pragma(`cipher = 'sqlcipher'`)
  db.pragma('legacy = 4')
  db.pragma(`key = ${quote(passphrase)}`)
}

function configure(db: BetterDB): void {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  // Les pages libérées (ex. élève effacé) sont écrasées par des zéros.
  db.pragma('secure_delete = ON')
  db.pragma('busy_timeout = 3000')
}

/**
 * Ouvre (ou crée) la base, applique la clé si fournie, vérifie qu'elle est
 * lisible puis exécute les migrations.
 */
export function openDatabase(path: string, passphrase: string | null): DB {
  const db = new Database(path)
  try {
    if (passphrase) applyKey(db, passphrase)
    try {
      db.prepare('SELECT count(*) FROM sqlite_master').get()
    } catch (err) {
      if ((err as { code?: string }).code === 'SQLITE_NOTADB') throw new WrongPassphraseError()
      throw err
    }
    configure(db)
    // better-sqlite3 implémente l'interface DB (ses types de transaction sont plus riches).
    const shared = db as unknown as DB
    migrate(shared)
    return shared
  } catch (err) {
    db.close()
    throw err
  }
}

/**
 * Change (ou supprime si `next` est null) le mot de passe de la base ouverte.
 * Le re-chiffrement n'est pas possible en mode WAL : on bascule temporairement
 * en journal classique.
 */
export function rekey(db: DB, next: string | null): void {
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.pragma('journal_mode = DELETE')
  try {
    if (next) {
      db.pragma(`cipher = 'sqlcipher'`)
      db.pragma('legacy = 4')
    }
    db.pragma(`rekey = ${quote(next ?? '')}`)
  } finally {
    db.pragma('journal_mode = WAL')
  }
}
