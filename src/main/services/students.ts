import type { DB } from '../db/connection'
import { assertId, ValidationError } from '../validation'

/** Tables contenant des données personnelles d'un élève (clé : student_id). */
const STUDENT_TABLES = [
  'student_contacts',
  'student_authorizations',
  'student_health',
  'student_accommodations',
  'student_observations'
] as const

/**
 * Droit d'accès / portabilité (art. 15 et 20 RGPD) : rassemble toutes les
 * données relatives à un élève dans un objet JSON autonome.
 */
export function exportStudentData(db: DB, classId: number, studentId: number): Record<string, unknown> {
  assertId(studentId, 'élève')
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND class_id = ?').get(studentId, classId)
  if (!student) throw new ValidationError('Élève introuvable')
  const data: Record<string, unknown> = {
    format: 'dina-student-export',
    version: 1,
    exported_at: new Date().toISOString(),
    student
  }
  for (const table of STUDENT_TABLES) {
    data[table] = db.prepare(`SELECT * FROM ${table} WHERE student_id = ?`).all(studentId)
  }
  data.appointments = db
    .prepare(
      `SELECT a.date, a.start_time, a.end_time, a.kind, a.title, a.location, a.participants, a.notes, a.report
         FROM appointments a JOIN appointment_students x ON x.appointment_id = a.id
        WHERE x.student_id = ? ORDER BY a.date`
    )
    .all(studentId)
  return data
}

/**
 * Droit à l'effacement (art. 17 RGPD) : la suppression de l'élève entraîne
 * en cascade celle de toutes ses données. `secure_delete` écrase les pages
 * libérées et le point de contrôle WAL purge le journal.
 */
export function eraseStudent(db: DB, classId: number, studentId: number): void {
  const { changes } = db
    .prepare('DELETE FROM students WHERE id = ? AND class_id = ?')
    .run(assertId(studentId, 'élève'), classId)
  if (changes === 0) throw new ValidationError('Élève introuvable')
  db.pragma('wal_checkpoint(TRUNCATE)')
}
