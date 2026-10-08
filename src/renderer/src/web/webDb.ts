import type { SqlJsStatic } from 'sql.js'
import type { DbStatus, SetupInput } from '@shared/types'
import type { DB } from '../../../main/db/types'
import { migrate } from '../../../main/db/migrator'
import { getCurrentClass } from '../../../main/repositories/classes'
import { initialSetup } from '../../../main/services/setup'
import { ValidationError } from '../../../main/validation'
import { idbGet, idbSet } from './idb'
import { SqlJsAdapter } from './sqljsAdapter'
import { decrypt, deriveKey, encrypt, randomBytes } from './webCrypto'

/** Base telle qu'enregistrée dans IndexedDB : le fichier SQLite, chiffré ou non. */
interface StoredDb {
  version: 1
  encrypted: boolean
  salt?: Uint8Array<ArrayBuffer>
  iv?: Uint8Array<ArrayBuffer>
  data: Uint8Array<ArrayBuffer>
  saved_at: string
}

const KEY = 'database'

export class WrongPassphraseError extends Error {
  constructor() {
    super('Mot de passe incorrect.')
    this.name = 'WrongPassphraseError'
  }
}

/**
 * Version navigateur du gestionnaire de base : SQLite (WebAssembly) en mémoire,
 * enregistré après chaque modification dans le stockage local de l'appareil,
 * chiffré en AES-256-GCM avec une clé dérivée du mot de passe.
 */
export class WebDbManager {
  private db: SqlJsAdapter | null = null
  private key: CryptoKey | null = null
  private salt: Uint8Array<ArrayBuffer> | null = null
  private stored: Pick<StoredDb, 'encrypted'> | null = null
  private savedChanges = 0
  private saving: Promise<void> = Promise.resolve()

  constructor(private readonly SQL: SqlJsStatic) {}

  async init(): Promise<void> {
    const rec = await idbGet<StoredDb>(KEY)
    this.stored = rec ? { encrypted: rec.encrypted } : null
    if (rec && !rec.encrypted) this.open(rec.data)
  }

  private open(bytes?: Uint8Array): void {
    this.db = new SqlJsAdapter(new this.SQL.Database(bytes))
    this.configure()
    migrate(this.db.asDB())
    this.savedChanges = this.db.totalChanges()
  }

  private configure(): void {
    this.db!.pragma('foreign_keys = ON')
    this.db!.pragma('secure_delete = ON')
  }

  status(): DbStatus {
    return {
      state: this.db ? 'open' : this.stored ? 'locked' : 'new',
      encrypted: Boolean(this.stored?.encrypted),
      path: 'Stockage local de cet appareil (navigateur)',
      current_class: this.db ? getCurrentClass(this.db.asDB()) : null
    }
  }

  async unlock(passphrase: string): Promise<DbStatus> {
    if (this.db) return this.status()
    const rec = await idbGet<StoredDb>(KEY)
    if (!rec) throw new ValidationError('Aucune base enregistrée')
    if (rec.encrypted) {
      const key = await deriveKey(passphrase, rec.salt!)
      let bytes: Uint8Array
      try {
        bytes = await decrypt(key, rec.iv!, rec.data)
      } catch {
        throw new WrongPassphraseError()
      }
      this.key = key
      this.salt = rec.salt!
      this.open(bytes)
    } else this.open(rec.data)
    return this.status()
  }

  async setup(input: SetupInput): Promise<DbStatus> {
    if (this.stored && !this.db) throw new ValidationError('Une base existe déjà : déverrouillez-la')
    if (input.passphrase !== null && input.passphrase.length < 8) {
      throw new ValidationError('Le mot de passe doit contenir au moins 8 caractères')
    }
    if (!this.db) this.open()
    if (getCurrentClass(this.db!.asDB())) throw new ValidationError('La classe est déjà configurée')
    await this.setKey(input.passphrase)
    initialSetup(this.db!.asDB(), input)
    // Demande au navigateur de ne pas effacer ces données en cas de manque de place.
    void navigator.storage?.persist?.()
    await this.save()
    return this.status()
  }

  private async setKey(passphrase: string | null): Promise<void> {
    if (passphrase) {
      this.salt = randomBytes(16)
      this.key = await deriveKey(passphrase, this.salt)
    } else {
      this.salt = null
      this.key = null
    }
  }

  async changePassphrase(next: string | null): Promise<DbStatus> {
    if (next !== null && next.length < 8) throw new ValidationError('Le mot de passe doit contenir au moins 8 caractères')
    this.get()
    await this.setKey(next)
    await this.save()
    return this.status()
  }

  lock(): DbStatus {
    this.db?.close()
    this.db = null
    this.key = null
    return this.status()
  }

  get(): DB {
    if (!this.db) throw new ValidationError('La base de données est verrouillée')
    return this.db.asDB()
  }

  classId(): number {
    const cls = getCurrentClass(this.get())
    if (!cls) throw new ValidationError('Aucune classe configurée')
    return cls.id
  }

  /** Enregistre si la base a été modifiée depuis le dernier enregistrement. */
  async persistIfChanged(): Promise<void> {
    if (this.db && this.db.totalChanges() !== this.savedChanges) await this.save()
  }

  save(): Promise<void> {
    this.saving = this.saving.then(async () => {
      if (!this.db) return
      // sql.js rouvre la connexion lors de l'export : on réapplique les réglages.
      const bytes = this.db.export() as Uint8Array<ArrayBuffer>
      this.configure()
      this.savedChanges = this.db.totalChanges()
      const rec: StoredDb =
        this.key && this.salt
          ? { version: 1, encrypted: true, salt: this.salt, ...(await encrypt(this.key, bytes)), saved_at: new Date().toISOString() }
          : { version: 1, encrypted: false, data: bytes, saved_at: new Date().toISOString() }
      await idbSet(KEY, rec)
      this.stored = { encrypted: rec.encrypted }
    })
    return this.saving
  }
}
