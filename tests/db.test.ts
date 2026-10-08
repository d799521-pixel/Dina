import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isEncryptedFile, openDatabase, rekey, WrongPassphraseError, type DB } from '../src/main/db/connection'
import { migrations } from '../src/main/db/migrations'
import { createClassWithYear } from '../src/main/repositories/classes'
import * as journal from '../src/main/repositories/journal'
import * as appts from '../src/main/repositories/appointments'
import { applyTimetableToWeek, saveWeekAsTimetable } from '../src/main/repositories/timetable'
import { listSubjects } from '../src/main/repositories/referentials'
import { createBackup, readBackup, restoreBackup } from '../src/main/services/backup'
import { eraseStudent, exportStudentData } from '../src/main/services/students'
import { initialSetup } from '../src/main/services/setup'

let dir: string
let db: DB
let classId: number

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dina-'))
  db = openDatabase(join(dir, 'test.db'), null)
  classId = createClassWithYear(db, '2026-2027', 'CE1-CE2', ['CE1', 'CE2']).id
})

afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

const subjectId = (short: string): number =>
  (db.prepare('SELECT id FROM subjects WHERE short_name = ?').get(short) as { id: number }).id

describe('migrations', () => {
  it('amène la base à la dernière version et active les clés étrangères', () => {
    expect(db.pragma('user_version', { simple: true })).toBe(migrations.at(-1)!.version)
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(db.pragma('secure_delete', { simple: true })).toBe(1)
  })

  it('est idempotente à la réouverture', () => {
    db.close()
    db = openDatabase(join(dir, 'test.db'), null)
    expect(listSubjects(db).length).toBeGreaterThan(10)
  })

  it("n'active pas les domaines de maternelle pour une classe élémentaire", () => {
    expect(listSubjects(db).find((s) => s.short_name === 'Explorer')?.archived).toBe(1)
  })
})

describe('chiffrement', () => {
  it('chiffre la base, refuse un mauvais mot de passe et permet le changement', () => {
    const path = join(dir, 'secret.db')
    const enc = openDatabase(path, 'correct horse')
    createClassWithYear(enc, '2026-2027', 'CP', ['CP'])
    enc.close()
    expect(isEncryptedFile(path)).toBe(true)
    expect(() => openDatabase(path, 'faux')).toThrow(WrongPassphraseError)
    expect(() => openDatabase(path, null)).toThrow(WrongPassphraseError)

    const reopened = openDatabase(path, 'correct horse')
    rekey(reopened, 'nouveau')
    reopened.close()
    expect(() => openDatabase(path, 'correct horse')).toThrow(WrongPassphraseError)
    const again = openDatabase(path, 'nouveau')
    rekey(again, null)
    again.close()
    expect(isEncryptedFile(path)).toBe(false)
  })
})

describe('cahier journal', () => {
  it('crée, lie une séance, met à jour et supprime un créneau', () => {
    initialSetupLessons()
    const lesson = db.prepare('SELECT id, sequence_id, title FROM lessons LIMIT 1').get() as {
      id: number
      sequence_id: number
      title: string
    }
    const slot = journal.createSlot(db, classId, {
      date: '2026-10-05',
      start_time: '10:15',
      end_time: '11:00',
      subject_id: null,
      title: '',
      socle_domain: 'D1.3',
      lesson_id: lesson.id
    })
    expect(slot.title).toBe(lesson.title) // titre repris de la séance
    expect(slot.sequence_id).toBe(lesson.sequence_id)
    expect(slot.subject_short).toBe('Maths')

    const done = journal.updateSlot(db, classId, slot.id, { status: 'fait', bilan: 'Séance réussie' })
    expect(done.status).toBe('fait')
    const unlinked = journal.updateSlot(db, classId, slot.id, { lesson_id: null })
    expect(unlinked.sequence_id).toBeNull()

    journal.addSlotNote(db, slot.id, 'retard', 'Arrivée de Léo à 10h30')
    expect(journal.getSlot(db, slot.id).notes_count).toBe(1)

    journal.deleteSlot(db, classId, slot.id)
    expect(() => journal.getSlot(db, slot.id)).toThrow(/introuvable/)
    expect(db.prepare('SELECT count(*) c FROM journal_slot_notes').get()).toEqual({ c: 0 })
  })

  it('refuse des horaires incohérents', () => {
    expect(() =>
      journal.createSlot(db, classId, {
        date: '2026-10-05', start_time: '11:00', end_time: '10:00',
        subject_id: null, title: 'x', socle_domain: null, lesson_id: null
      })
    ).toThrow(/heure de fin/)
  })

  it('enregistre et applique un emploi du temps type sans doublon', () => {
    journal.createSlot(db, classId, {
      date: '2026-10-05', start_time: '08:30', end_time: '09:00',
      subject_id: subjectId('Rituels'), title: 'Accueil', socle_domain: null, lesson_id: null
    })
    journal.createSlot(db, classId, {
      date: '2026-10-08', start_time: '09:00', end_time: '10:00',
      subject_id: subjectId('Français'), title: 'Lecture', socle_domain: null, lesson_id: null
    })
    expect(saveWeekAsTimetable(db, classId, '2026-10-05')).toBe(2)
    expect(applyTimetableToWeek(db, classId, '2026-10-12', [1, 2, 4, 5])).toBe(2)
    expect(applyTimetableToWeek(db, classId, '2026-10-12', [1, 2, 4, 5])).toBe(0)
    const week = journal.listSlots(db, classId, '2026-10-12', '2026-10-18')
    expect(week.map((s) => [s.date, s.title])).toEqual([
      ['2026-10-12', 'Accueil'],
      ['2026-10-15', 'Lecture']
    ])
  })

  it('stocke une note de journée et la supprime si vide', () => {
    journal.setDayNote(db, classId, '2026-10-05', 'Sortie au musée')
    expect(journal.getDayNote(db, classId, '2026-10-05')).toBe('Sortie au musée')
    journal.setDayNote(db, classId, '2026-10-05', '  ')
    expect(db.prepare('SELECT count(*) c FROM journal_day_notes').get()).toEqual({ c: 0 })
  })
})

describe('RGPD', () => {
  it("exporte puis efface toutes les données d'un élève", () => {
    const sid = Number(
      db.prepare("INSERT INTO students (class_id, last_name, first_name) VALUES (?, 'Martin', 'Léa')").run(classId)
        .lastInsertRowid
    )
    db.prepare("INSERT INTO student_health (student_id, allergies, has_pai) VALUES (?, 'arachide', 1)").run(sid)
    db.prepare("INSERT INTO student_contacts (student_id, full_name, phone) VALUES (?, 'Mme Martin', '0600000000')").run(sid)
    const rdv = appts.createAppointment(db, classId, {
      date: '2026-10-06', start_time: '16:45', end_time: '17:15', kind: 'parents',
      title: 'Point lecture', location: '', participants: '', notes: '', report: '', student_ids: [sid]
    })
    expect(rdv.student_ids).toEqual([sid])

    const exported = exportStudentData(db, classId, sid)
    expect(exported.student_health).toHaveLength(1)
    expect(exported.appointments).toHaveLength(1)

    eraseStudent(db, classId, sid)
    for (const t of ['students', 'student_health', 'student_contacts', 'appointment_students']) {
      expect(db.prepare(`SELECT count(*) c FROM ${t}`).get()).toEqual({ c: 0 })
    }
    // Le rendez-vous lui-même (événement de la classe) est conservé, sans lien vers l'élève.
    expect(appts.getAppointment(db, rdv.id).student_ids).toEqual([])
  })
})

describe('sauvegarde', () => {
  it('exporte en chiffré et restaure à l’identique', () => {
    journal.createSlot(db, classId, {
      date: '2026-10-05', start_time: '08:30', end_time: '09:00',
      subject_id: subjectId('Rituels'), title: 'Accueil', socle_domain: null, lesson_id: null
    })
    const env = createBackup(db, 'sauvegarde')
    const serialized = JSON.stringify(env)
    expect(serialized).not.toContain('Accueil')
    expect(() => readBackup(JSON.parse(serialized), 'mauvais')).toThrow(/Mot de passe/)

    journal.deleteSlot(db, classId, 1)
    restoreBackup(db, readBackup(JSON.parse(serialized), 'sauvegarde'))
    expect(journal.listSlots(db, classId, '2026-10-05', '2026-10-05')[0].title).toBe('Accueil')
    expect(db.pragma('foreign_key_check')).toEqual([])
  })
})

function initialSetupLessons(): void {
  // Le jeu de démonstration crée séquence, séances et emploi du temps.
  db.close()
  db = openDatabase(join(dir, 'demo.db'), null)
  initialSetup(db, { passphrase: null, class_name: 'CE1', levels: ['CE1'], school_year_label: '2026-2027', demo: true })
  classId = (db.prepare('SELECT id FROM classes').get() as { id: number }).id
}
