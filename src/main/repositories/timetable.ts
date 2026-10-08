import { addDays, isoWeekday } from '@shared/date'
import type { TimetableImportSlot, TimetableSlot } from '@shared/types'
import type { DB } from '../db/types'
import { assertDate, assertTimeRange, text, ValidationError } from '../validation'

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
        `SELECT date, start_time, end_time, subject_id, title, audience FROM journal_slots
          WHERE class_id = ? AND date BETWEEN ? AND ? AND status != 'annule'`
      )
      .all(classId, weekStart, weekEnd) as {
      date: string
      start_time: string
      end_time: string
      subject_id: number | null
      title: string
      audience: string
    }[]
    const insert = db.prepare(
      'INSERT INTO timetable_slots (template_id, weekday, start_time, end_time, subject_id, label, audience) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of slots) insert.run(tid, isoWeekday(s.date), s.start_time, s.end_time, s.subject_id, s.title, s.audience)
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
      `INSERT INTO journal_slots (class_id, date, start_time, end_time, subject_id, title, audience)
       SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM journal_slots
                           WHERE class_id = ? AND date = ? AND start_time = ? AND audience = ? AND title = ?)`
    )
    let created = 0
    for (const t of template) {
      if (!schoolDays.includes(t.weekday)) continue
      const date = addDays(weekStart, t.weekday - 1)
      created += insert.run(
        classId, date, t.start_time, t.end_time, t.subject_id, t.label, t.audience,
        classId, date, t.start_time, t.audience, t.label
      ).changes
    }
    return created
  })()
}


/** Remplace l'emploi du temps type (import d'un modèle). Renvoie le nombre de créneaux. */
export function replaceTimetable(db: DB, classId: number, slots: TimetableImportSlot[]): number {
  if (!Array.isArray(slots) || slots.length > 500) throw new ValidationError('Emploi du temps invalide')
  const subjectId = db.prepare(
    `SELECT id FROM subjects WHERE lower(name) = lower(?) OR lower(short_name) = lower(?) ORDER BY archived, position LIMIT 1`
  )
  return db.transaction(() => {
    const tid = templateId(db, classId)
    db.prepare('DELETE FROM timetable_slots WHERE template_id = ?').run(tid)
    const insert = db.prepare(
      'INSERT INTO timetable_slots (template_id, weekday, start_time, end_time, subject_id, label, audience) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const s of slots) {
      if (!Number.isInteger(s.weekday) || s.weekday < 1 || s.weekday > 7) throw new ValidationError('Jour invalide')
      const [start, end] = assertTimeRange(s.start_time, s.end_time)
      const sid = s.subject ? ((subjectId.get(s.subject, s.subject) as { id: number } | undefined)?.id ?? null) : null
      insert.run(tid, s.weekday, start, end, sid, text(s.label, 'intitulé', 300), text(s.audience, 'groupe', 60))
    }
    return slots.length
  })()
}
