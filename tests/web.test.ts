import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { migrate } from '../src/main/db/migrator'
import { migrations } from '../src/main/db/migrations'
import { getCurrentClass } from '../src/main/repositories/classes'
import * as journal from '../src/main/repositories/journal'
import * as prep from '../src/main/repositories/preparations'
import * as students from '../src/main/repositories/students'
import { createPayload, restoreBackup } from '../src/main/services/backupCore'
import { createBackup, readBackup } from '../src/main/services/backup'
import { initialSetup } from '../src/main/services/setup'
import { SqlJsAdapter } from '../src/renderer/src/web/sqljsAdapter'
import { createBackupWeb, decrypt, deriveKey, encrypt, randomBytes, readBackupWeb } from '../src/renderer/src/web/webCrypto'

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})

function newDb(): SqlJsAdapter {
  const a = new SqlJsAdapter(new SQL.Database())
  a.pragma('foreign_keys = ON')
  migrate(a.asDB())
  return a
}

describe('version iPad : SQLite WebAssembly', () => {
  it('applique les migrations et le jeu de démonstration avec les mêmes repositories', () => {
    const a = newDb()
    const db = a.asDB()
    expect(db.pragma('user_version', { simple: true })).toBe(migrations.at(-1)!.version)
    initialSetup(db, { passphrase: null, class_name: 'CP', levels: ['CP'], school_year_label: '2026-2027', demo: true })
    const cls = getCurrentClass(db)!
    expect(prep.listSequences(db, cls.id)).toHaveLength(1)
    const slots = journal.listSlots(db, cls.id, '2000-01-01', '2100-01-01')
    expect(slots.length).toBeGreaterThan(10)
    expect(slots[0].subject_name).toBeTruthy()
  })

  it('respecte les clés étrangères, les cascades et annule une transaction en erreur', () => {
    const a = newDb()
    const db = a.asDB()
    initialSetup(db, { passphrase: null, class_name: 'CE1', levels: ['CE1'], school_year_label: '2026-2027', demo: false })
    const cls = getCurrentClass(db)!.id
    const s = students.saveStudentFile(db, cls, {
      id: null, last_name: 'Durand', first_name: 'Tom', birth_date: null, level: 'CE1', entry_date: null, leave_date: null,
      contacts: [{ full_name: 'M. Durand', relation: 'Père', phone: '', phone_alt: '', email: '', address: '', is_legal_guardian: 1, is_emergency: 1, can_pick_up: 1 }],
      authorizations: [], health: { allergies: '', has_pai: 0, pai_details: '', medical_notes: '' }, accommodations: []
    })
    expect(s.contacts).toHaveLength(1)
    // Une erreur au milieu de la transaction ne laisse aucune trace.
    expect(() =>
      students.saveStudentFile(db, cls, { ...s, accommodations: [{ type: 'INVALIDE' as never, start_date: null, end_date: null, details: '' }] })
    ).toThrow()
    expect(students.getStudentFile(db, cls, s.id!).contacts).toHaveLength(1)
    db.prepare('DELETE FROM students WHERE id = ?').run(s.id)
    expect(db.prepare('SELECT count(*) AS c FROM student_contacts').get()).toEqual({ c: 0 })
  })

  it('survit à un export / réimport du fichier SQLite', () => {
    const a = newDb()
    initialSetup(a.asDB(), { passphrase: null, class_name: 'CM1', levels: ['CM1'], school_year_label: '2026-2027', demo: true })
    const bytes = a.export()
    const b = new SqlJsAdapter(new SQL.Database(bytes))
    migrate(b.asDB())
    expect(getCurrentClass(b.asDB())?.name).toBe('CM1')
  })
})

describe('version iPad : chiffrement', () => {
  it('chiffre la base et refuse un mauvais mot de passe', async () => {
    const salt = randomBytes(16)
    const key = await deriveKey('un mot de passe', salt, 1000)
    const plain = new TextEncoder().encode('données de la classe')
    const { iv, data } = await encrypt(key, plain)
    expect(new TextDecoder().decode(await decrypt(key, iv, data))).toBe('données de la classe')
    const wrong = await deriveKey('autre', salt, 1000)
    await expect(decrypt(wrong, iv, data)).rejects.toThrow()
  })

  it('échange des sauvegardes chiffrées dans les deux sens avec l’application de bureau', async () => {
    const a = newDb()
    initialSetup(a.asDB(), { passphrase: null, class_name: 'CE2', levels: ['CE2'], school_year_label: '2026-2027', demo: true })

    // iPad → ordinateur
    const fromWeb = await createBackupWeb(createPayload(a.asDB()), 'motdepasse')
    const payload1 = readBackup(JSON.parse(JSON.stringify(fromWeb)), 'motdepasse')
    expect(payload1.tables.classes[0].name).toBe('CE2')

    // ordinateur → iPad
    const fromDesktop = createBackup(a.asDB(), 'motdepasse')
    const payload2 = await readBackupWeb(JSON.parse(JSON.stringify(fromDesktop)), 'motdepasse')
    await expect(readBackupWeb(fromDesktop, 'faux')).rejects.toThrow(/Mot de passe/)

    const b = newDb()
    restoreBackup(b.asDB(), payload2)
    expect(getCurrentClass(b.asDB())?.name).toBe('CE2')
    expect(b.asDB().pragma('foreign_key_check')).toEqual([])
  })
})
