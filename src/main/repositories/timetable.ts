import { addDays, isoWeekday } from '@shared/date'
import type { TimetableSlot } from '@shared/types'
import type { DB } from '../db/types'
import { assertDate, ValidationError } from '../validation'

function templateId(db: DB, classId: number): number {
  const row = db.prepare('SELECT id FROM timetable_templates WHERE class_id = ? ORDER BY id LIMIT 1').get(classId) as
    | { id: number }
    | undefined
  if (row) return row.id
  return Number(
    db.prepare('INSERT INTO timetable_templates (class_id, name) VALUES (?, ?)').run(classId, 'Emploi du temps')
      .lastInsertRowid
  )
}

export function getTimetable(db: DB, classId: number): TimetableSlot[] {
  return db
    .prepare('SELECT * FROM timetable_slots WHERE template_id = ? ORDER BY weekday, start_time')
    .all(templateId(db, classId)) as TimetableSlot[]
}

/** Enregistre les créneaux de la semaine affichée comme emploi du temps type. */
export function saveWeekAsTimetable(db: DB, classId: number, weekStart: string): number {
  assertDate(weekStart)
  if (isoWeekday(weekStart) !== 1) throw new ValidationError('La semaine doit commencer un lundi')
  const weekEnd = addDays(weekStart, 6)
  return db.transaction(() => {
    const tid = templateId(db, classId)
    db.prepare('DELETE FROM timetable_slots WHERE template_id = ?').run(tid)
    const slots = db
      .prepare(
        `SELECT date, start_time, end_time, subject_id, title FROM journal_slots
          WHERE class_id = ? AND date BETWEEN ? AND ? AND status != 'annule'`
      )
      .all(classId, weekStart, weekEnd) as {
      date: string
      start_time: string
      end_time: string
      subject_id: number | null
      title: string
    }[]
    const insert = db.prepare(
      'INSERT INTO timetable_slots (template_id, weekday, start_time, end_time, subject_id, label) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const s of slots) insert.run(tid, isoWeekday(s.date), s.start_time, s.end_time, s.subject_id, s.title)
    return slots.length
  })()
}

/**
 * Pré-remplit une semaine du cahier journal à partir de l'emploi du temps type.
 * Les créneaux déjà présents (même jour, même heure de début) sont conservés.
 */
export function applyTimetableToWeek(db: DB, classId: number, weekStart: string, schoolDays: number[]): number {
  assertDate(weekStart)
  if (isoWeekday(weekStart) !== 1) throw new ValidationError('La semaine doit commencer un lundi')
  const template = getTimetable(db, classId)
  return db.transaction(() => {
    const insert = db.prepare(
      `INSERT INTO journal_slots (class_id, date, start_time, end_time, subject_id, title)
       SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM journal_slots WHERE class_id = ? AND date = ? AND start_time = ?)`
    )
    let created = 0
    for (const t of template) {
      if (!schoolDays.includes(t.weekday)) continue
      const date = addDays(weekStart, t.weekday - 1)
      created += insert.run(classId, date, t.start_time, t.end_time, t.subject_id, t.label, classId, date, t.start_time).changes
    }
    return created
  })()
}
