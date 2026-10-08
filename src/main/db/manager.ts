import { existsSync } from 'node:fs'
import type { DbStatus, SetupInput } from '@shared/types'
import { getCurrentClass } from '../repositories/classes'
import { initialSetup } from '../services/setup'
import { ValidationError } from '../validation'
import { isEncryptedFile, openDatabase, rekey, type DB } from './connection'

/** Détient l'unique connexion SQLite de l'application. */
export class DbManager {
  private db: DB | null = null

  constructor(readonly path: string) {}

  /** Ouvre directement une base existante non chiffrée. */
  tryAutoOpen(): void {
    if (existsSync(this.path) && !isEncryptedFile(this.path)) this.db = openDatabase(this.path, null)
  }

  status(): DbStatus {
    const exists = existsSync(this.path)
    return {
      state: this.db ? 'open' : exists ? 'locked' : 'new',
      encrypted: exists && isEncryptedFile(this.path),
      path: this.path,
      current_class: this.db ? getCurrentClass(this.db) : null
    }
  }

  unlock(passphrase: string): DbStatus {
    if (!this.db) this.db = openDatabase(this.path, passphrase || null)
    return this.status()
  }

  setup(input: SetupInput): DbStatus {
    if (existsSync(this.path) && this.db === null) throw new ValidationError('Une base existe déjà : déverrouillez-la')
    if (input.passphrase !== null && input.passphrase.length < 8) {
      throw new ValidationError('Le mot de passe doit contenir au moins 8 caractères')
    }
    this.db ??= openDatabase(this.path, input.passphrase)
    if (getCurrentClass(this.db)) throw new ValidationError('La classe est déjà configurée')
    initialSetup(this.db, input)
    return this.status()
  }

  changePassphrase(next: string | null): DbStatus {
    if (next !== null && next.length < 8) throw new ValidationError('Le mot de passe doit contenir au moins 8 caractères')
    rekey(this.get(), next)
    return this.status()
  }

  lock(): DbStatus {
    this.close()
    return this.status()
  }

  get(): DB {
    if (!this.db) throw new ValidationError('La base de données est verrouillée')
    return this.db
  }

  classId(): number {
    const cls = getCurrentClass(this.get())
    if (!cls) throw new ValidationError('Aucune classe configurée')
    return cls.id
  }

  close(): void {
    this.db?.close()
    this.db = null
  }
}
