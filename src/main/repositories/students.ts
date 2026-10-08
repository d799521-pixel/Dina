import {
  ACCOMMODATION_TYPES,
  type StudentAppointment,
  type StudentFile,
  type StudentHealth,
  type StudentListItem,
  type StudentObservation
} from '@shared/types'
import type { DB } from '../db/connection'
import { assertDate, assertEnum, assertId, optionalId, text, ValidationError } from '../validation'

const bit = (v: unknown): 0 | 1 => (v ? 1 : 0)
const optionalDate = (v: unknown, field: string): string | null => (v ? assertDate(v, field) : null)

export function listStudents(db: DB, classId: number, includeLeft = false): StudentListItem[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.first_name, s.last_name, s.level, s.birth_date,
              coalesce(h.has_pai, 0) AS has_pai, coalesce(h.allergies, '') AS allergies,
              (SELECT json_group_array(type) FROM student_accommodations a
                WHERE a.student_id = s.id AND (a.end_date IS NULL OR a.end_date >= date('now'))) AS accommodations,
              (SELECT granted FROM student_authorizations z WHERE z.student_id = s.id AND z.kind = 'photo') AS photo_ok
         FROM students s LEFT JOIN student_health h ON h.student_id = s.id
        WHERE s.class_id = ? ${includeLeft ? '' : 'AND s.leave_date IS NULL'}
        ORDER BY s.last_name COLLATE NOCASE, s.first_name COLLATE NOCASE`
    )
    .all(classId) as (Omit<StudentListItem, 'accommodations'> & { accommodations: string })[]
  return rows.map((r) => ({ ...r, accommodations: JSON.parse(r.accommodations) as string[] }))
}

const EMPTY_HEALTH: StudentHealth = { allergies: '', has_pai: 0, pai_details: '', medical_notes: '' }

export function getStudentFile(db: DB, classId: number, id: number): StudentFile {
  const s = db.prepare('SELECT * FROM students WHERE id = ? AND class_id = ?').get(assertId(id, 'élève'), classId) as
    | Omit<StudentFile, 'contacts' | 'authorizations' | 'health' | 'accommodations'>
    | undefined
  if (!s) throw new ValidationError('Élève introuvable')
  return {
    id: s.id,
    last_name: s.last_name,
    first_name: s.first_name,
    birth_date: s.birth_date,
    level: s.level,
    entry_date: s.entry_date,
    leave_date: s.leave_date,
    contacts: db
      .prepare(
        `SELECT id, full_name, relation, phone, phone_alt, email, address, is_legal_guardian, is_emergency, can_pick_up
           FROM student_contacts WHERE student_id = ? ORDER BY priority, id`
      )
      .all(id) as StudentFile['contacts'],
    authorizations: db
      .prepare('SELECT kind, granted, signed_on, comment FROM student_authorizations WHERE student_id = ? ORDER BY kind')
      .all(id) as StudentFile['authorizations'],
    health:
      (db
        .prepare('SELECT allergies, has_pai, pai_details, medical_notes FROM student_health WHERE student_id = ?')
        .get(id) as StudentHealth | undefined) ?? EMPTY_HEALTH,
    accommodations: db
      .prepare('SELECT id, type, start_date, end_date, details FROM student_accommodations WHERE student_id = ? ORDER BY start_date, id')
      .all(id) as StudentFile['accommodations']
  }
}

/** Enregistre la fiche complète en une transaction (création si `id` est null). */
export function saveStudentFile(db: DB, classId: number, file: StudentFile): StudentFile {
  const last = text(file.last_name, 'nom', 100).trim()
  const first = text(file.first_name, 'prénom', 100).trim()
  if (!last || !first) throw new ValidationError('Le nom et le prénom sont obligatoires')
  const values = [
    last,
    first,
    optionalDate(file.birth_date, 'date de naissance'),
    text(file.level, 'niveau', 20),
    optionalDate(file.entry_date, "date d'entrée"),
    optionalDate(file.leave_date, 'date de sortie')
  ]

  return db.transaction(() => {
    let id = optionalId(file.id, 'élève')
    if (id === null) {
      id = Number(
        db
          .prepare(
            'INSERT INTO students (last_name, first_name, birth_date, level, entry_date, leave_date, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .run(...values, classId).lastInsertRowid
      )
    } else {
      const { changes } = db
        .prepare(
          `UPDATE students SET last_name = ?, first_name = ?, birth_date = ?, level = ?, entry_date = ?, leave_date = ?,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ? AND class_id = ?`
        )
        .run(...values, id, classId)
      if (changes === 0) throw new ValidationError('Élève introuvable')
    }

    db.prepare('DELETE FROM student_contacts WHERE student_id = ?').run(id)
    const contact = db.prepare(
      `INSERT INTO student_contacts (student_id, full_name, relation, phone, phone_alt, email, address,
                                     is_legal_guardian, is_emergency, can_pick_up, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    ;(file.contacts ?? [])
      .filter((c) => c.full_name?.trim())
      .forEach((c, i) =>
        contact.run(
          id, text(c.full_name, 'contact', 200).trim(), text(c.relation, 'lien', 100), text(c.phone, 'téléphone', 40),
          text(c.phone_alt, 'téléphone', 40), text(c.email, 'courriel', 200), text(c.address, 'adresse', 500),
          bit(c.is_legal_guardian), bit(c.is_emergency), bit(c.can_pick_up), i
        )
      )

    db.prepare('DELETE FROM student_authorizations WHERE student_id = ?').run(id)
    const auth = db.prepare(
      'INSERT INTO student_authorizations (student_id, kind, granted, signed_on, comment) VALUES (?, ?, ?, ?, ?)'
    )
    for (const a of file.authorizations ?? []) {
      const kind = text(a.kind, 'autorisation', 60).trim()
      if (kind) auth.run(id, kind, bit(a.granted), optionalDate(a.signed_on, 'date de signature'), text(a.comment, 'commentaire', 500))
    }

    const h = file.health ?? EMPTY_HEALTH
    db.prepare(
      `INSERT INTO student_health (student_id, allergies, has_pai, pai_details, medical_notes) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(student_id) DO UPDATE SET allergies = excluded.allergies, has_pai = excluded.has_pai,
         pai_details = excluded.pai_details, medical_notes = excluded.medical_notes`
    ).run(id, text(h.allergies, 'allergies', 2000), bit(h.has_pai), text(h.pai_details, 'PAI'), text(h.medical_notes, 'notes médicales'))

    db.prepare('DELETE FROM student_accommodations WHERE student_id = ?').run(id)
    const acc = db.prepare(
      'INSERT INTO student_accommodations (student_id, type, start_date, end_date, details) VALUES (?, ?, ?, ?, ?)'
    )
    for (const a of file.accommodations ?? []) {
      acc.run(
        id, assertEnum(a.type, ACCOMMODATION_TYPES, 'aménagement'), optionalDate(a.start_date, 'début'),
        optionalDate(a.end_date, 'fin'), text(a.details, 'détails')
      )
    }
    return getStudentFile(db, classId, id)
  })()
}

// ------------------------------------------------------------------ Suivi

function assertStudent(db: DB, classId: number, studentId: number): void {
  if (!db.prepare('SELECT 1 FROM students WHERE id = ? AND class_id = ?').get(assertId(studentId, 'élève'), classId)) {
    throw new ValidationError('Élève introuvable')
  }
}

export function listObservations(db: DB, classId: number, studentId: number): StudentObservation[] {
  assertStudent(db, classId, studentId)
  return db
    .prepare('SELECT * FROM student_observations WHERE student_id = ? ORDER BY date DESC, id DESC')
    .all(studentId) as StudentObservation[]
}

export function addObservation(
  db: DB,
  classId: number,
  studentId: number,
  input: { date: string; category: string; content: string }
): StudentObservation {
  assertStudent(db, classId, studentId)
  const content = text(input.content, 'observation', 5000).trim()
  if (!content) throw new ValidationError("L'observation est vide")
  const { lastInsertRowid } = db
    .prepare('INSERT INTO student_observations (student_id, date, category, content) VALUES (?, ?, ?, ?)')
    .run(studentId, assertDate(input.date), text(input.category, 'catégorie', 60) || 'general', content)
  return db.prepare('SELECT * FROM student_observations WHERE id = ?').get(lastInsertRowid) as StudentObservation
}

export function deleteObservation(db: DB, classId: number, id: number): void {
  db.prepare(
    'DELETE FROM student_observations WHERE id = ? AND student_id IN (SELECT id FROM students WHERE class_id = ?)'
  ).run(assertId(id), classId)
}

export function listStudentAppointments(db: DB, classId: number, studentId: number): StudentAppointment[] {
  assertStudent(db, classId, studentId)
  return db
    .prepare(
      `SELECT a.id, a.date, a.start_time, a.kind, a.title, a.report
         FROM appointments a JOIN appointment_students x ON x.appointment_id = a.id
        WHERE x.student_id = ? ORDER BY a.date DESC`
    )
    .all(studentId) as StudentAppointment[]
}
