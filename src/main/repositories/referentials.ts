import type { LessonSummary, SocleDomain, StudentSummary, Subject } from '@shared/types'
import type { DB } from '../db/connection'

export function listSubjects(db: DB): Subject[] {
  return db.prepare('SELECT * FROM subjects ORDER BY archived, position, name').all() as Subject[]
}

export function listSocleDomains(db: DB): SocleDomain[] {
  return db.prepare('SELECT * FROM socle_domains ORDER BY code').all() as SocleDomain[]
}

/** Liste des séances disponibles pour le lien « en un clic » depuis le journal. */
export function listLessonSummaries(db: DB, classId: number): LessonSummary[] {
  return db
    .prepare(
      `SELECT l.id, l.title, l.subject_id, l.sequence_id, seq.title AS sequence_title,
              l.number_in_sequence, l.specific_objective, l.duration_min
         FROM lessons l
         LEFT JOIN sequences seq ON seq.id = l.sequence_id
        WHERE l.class_id = ?
        ORDER BY seq.title, l.number_in_sequence, l.title`
    )
    .all(classId) as LessonSummary[]
}

export function listStudentSummaries(db: DB, classId: number): StudentSummary[] {
  return db
    .prepare(
      `SELECT id, first_name, last_name, level FROM students
        WHERE class_id = ? AND leave_date IS NULL
        ORDER BY last_name, first_name`
    )
    .all(classId) as StudentSummary[]
}
