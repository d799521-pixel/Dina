import { APPOINTMENT_KINDS, type Appointment, type AppointmentInput } from '@shared/types'
import type { DB } from '../db/types'
import { assertDate, assertEnum, assertId, assertTimeRange, text, ValidationError } from '../validation'

type Row = Omit<Appointment, 'student_ids'> & { student_ids: string | null }

const SELECT = /* sql */ `
  SELECT a.*, (SELECT json_group_array(student_id) FROM appointment_students x
                WHERE x.appointment_id = a.id) AS student_ids
    FROM appointments a`

const toAppointment = (r: Row): Appointment => ({
  ...r,
  student_ids: r.student_ids ? (JSON.parse(r.student_ids) as number[]) : []
})

export function listAppointments(db: DB, classId: number, from: string, to: string): Appointment[] {
  return (
    db
      .prepare(`${SELECT} WHERE a.class_id = ? AND a.date BETWEEN ? AND ? ORDER BY a.date, a.start_time`)
      .all(classId, assertDate(from), assertDate(to)) as Row[]
  ).map(toAppointment)
}

export function getAppointment(db: DB, id: number): Appointment {
  const row = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Row | undefined
  if (!row) throw new ValidationError('Rendez-vous introuvable')
  return toAppointment(row)
}

function values(input: AppointmentInput): unknown[] {
  const [start, end] = assertTimeRange(input.start_time, input.end_time)
  const title = text(input.title, 'objet', 300).trim()
  if (!title) throw new ValidationError("L'objet du rendez-vous est obligatoire")
  return [
    assertDate(input.date),
    start,
    end,
    assertEnum(input.kind, APPOINTMENT_KINDS, 'type de rendez-vous'),
    title,
    text(input.location, 'lieu', 300),
    text(input.participants, 'participants', 2000),
    text(input.notes, 'notes'),
    text(input.report, 'compte rendu')
  ]
}

function linkStudents(db: DB, classId: number, appointmentId: number, studentIds: number[]): void {
  db.prepare('DELETE FROM appointment_students WHERE appointment_id = ?').run(appointmentId)
  const insert = db.prepare(
    `INSERT INTO appointment_students (appointment_id, student_id)
     SELECT ?, id FROM students WHERE id = ? AND class_id = ?`
  )
  for (const sid of studentIds ?? []) insert.run(appointmentId, assertId(sid, 'élève'), classId)
}

export function createAppointment(db: DB, classId: number, input: AppointmentInput): Appointment {
  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO appointments
           (class_id, date, start_time, end_time, kind, title, location, participants, notes, report)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(classId, ...values(input))
    const id = Number(lastInsertRowid)
    linkStudents(db, classId, id, input.student_ids)
    return getAppointment(db, id)
  })()
}

export function updateAppointment(db: DB, classId: number, id: number, input: AppointmentInput): Appointment {
  return db.transaction(() => {
    const { changes } = db
      .prepare(
        `UPDATE appointments
            SET date = ?, start_time = ?, end_time = ?, kind = ?, title = ?, location = ?,
                participants = ?, notes = ?, report = ?
          WHERE id = ? AND class_id = ?`
      )
      .run(...values(input), assertId(id), classId)
    if (changes === 0) throw new ValidationError('Rendez-vous introuvable')
    linkStudents(db, classId, id, input.student_ids)
    return getAppointment(db, id)
  })()
}

export function deleteAppointment(db: DB, classId: number, id: number): void {
  db.prepare('DELETE FROM appointments WHERE id = ? AND class_id = ?').run(assertId(id), classId)
}
