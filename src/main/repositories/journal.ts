import {
  SLOT_NOTE_KINDS,
  SLOT_STATUSES,
  type JournalSlotInput,
  type JournalSlotNote,
  type JournalSlotView,
  type SlotNoteKind,
  type SlotStatus
} from '@shared/types'
import type { DB } from '../db/connection'
import {
  assertDate,
  assertEnum,
  assertId,
  assertTimeRange,
  optionalId,
  text,
  ValidationError
} from '../validation'

const SLOT_VIEW = /* sql */ `
  SELECT s.*,
         sub.name       AS subject_name,
         sub.short_name AS subject_short,
         sub.color      AS subject_color,
         sub.icon       AS subject_icon,
         l.title              AS lesson_title,
         l.specific_objective AS lesson_objective,
         seq.title            AS sequence_title,
         (SELECT count(*) FROM journal_slot_notes n WHERE n.slot_id = s.id) AS notes_count
    FROM journal_slots s
    LEFT JOIN subjects  sub ON sub.id = s.subject_id
    LEFT JOIN lessons   l   ON l.id   = s.lesson_id
    LEFT JOIN sequences seq ON seq.id = s.sequence_id`

export function listSlots(db: DB, classId: number, from: string, to: string): JournalSlotView[] {
  assertDate(from, 'début')
  assertDate(to, 'fin')
  return db
    .prepare(`${SLOT_VIEW} WHERE s.class_id = ? AND s.date BETWEEN ? AND ? ORDER BY s.date, s.start_time`)
    .all(classId, from, to) as JournalSlotView[]
}

export function getSlot(db: DB, id: number): JournalSlotView {
  const row = db.prepare(`${SLOT_VIEW} WHERE s.id = ?`).get(id) as JournalSlotView | undefined
  if (!row) throw new ValidationError('Créneau introuvable')
  return row
}

interface LessonLink {
  sequence_id: number | null
  subject_id: number | null
  title: string
}

function lessonLink(db: DB, classId: number, lessonId: number | null): LessonLink | null {
  if (lessonId === null) return null
  const row = db
    .prepare('SELECT sequence_id, subject_id, title FROM lessons WHERE id = ? AND class_id = ?')
    .get(lessonId, classId) as LessonLink | undefined
  if (!row) throw new ValidationError('Séance introuvable')
  return row
}

export function createSlot(db: DB, classId: number, input: JournalSlotInput): JournalSlotView {
  const date = assertDate(input.date)
  const [start, end] = assertTimeRange(input.start_time, input.end_time)
  const lessonId = optionalId(input.lesson_id, 'séance')
  const lesson = lessonLink(db, classId, lessonId)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO journal_slots
         (class_id, date, start_time, end_time, subject_id, title, socle_domain, lesson_id, sequence_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      classId,
      date,
      start,
      end,
      optionalId(input.subject_id, 'matière') ?? lesson?.subject_id ?? null,
      text(input.title, 'titre', 300) || lesson?.title || '',
      input.socle_domain || null,
      lessonId,
      lesson?.sequence_id ?? null
    )
  return getSlot(db, Number(lastInsertRowid))
}

export type SlotPatch = Partial<JournalSlotInput> & { status?: SlotStatus; bilan?: string }

export function updateSlot(db: DB, classId: number, id: number, patch: SlotPatch): JournalSlotView {
  assertId(id)
  const current = getSlot(db, id)
  if (current.class_id !== classId) throw new ValidationError('Créneau introuvable')

  const next = { ...current, ...patch }
  const [start, end] = assertTimeRange(next.start_time, next.end_time)
  let sequenceId = current.sequence_id
  if ('lesson_id' in patch) {
    const lesson = lessonLink(db, classId, optionalId(patch.lesson_id, 'séance'))
    sequenceId = lesson?.sequence_id ?? null
  }

  db.prepare(
    `UPDATE journal_slots
        SET date = ?, start_time = ?, end_time = ?, subject_id = ?, title = ?, socle_domain = ?,
            lesson_id = ?, sequence_id = ?, status = ?, bilan = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?`
  ).run(
    assertDate(next.date),
    start,
    end,
    optionalId(next.subject_id, 'matière'),
    text(next.title, 'titre', 300),
    next.socle_domain || null,
    optionalId(next.lesson_id, 'séance'),
    sequenceId,
    assertEnum(next.status, SLOT_STATUSES, 'statut'),
    text(next.bilan, 'bilan'),
    id
  )
  return getSlot(db, id)
}

export function deleteSlot(db: DB, classId: number, id: number): void {
  db.prepare('DELETE FROM journal_slots WHERE id = ? AND class_id = ?').run(assertId(id), classId)
}

// ------------------------------------------------------------------ Remarques rapides

export function listSlotNotes(db: DB, slotId: number): JournalSlotNote[] {
  return db
    .prepare('SELECT * FROM journal_slot_notes WHERE slot_id = ? ORDER BY created_at')
    .all(assertId(slotId)) as JournalSlotNote[]
}

export function addSlotNote(db: DB, slotId: number, kind: SlotNoteKind, content: string): JournalSlotNote {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO journal_slot_notes (slot_id, kind, content) VALUES (?, ?, ?)')
    .run(assertId(slotId), assertEnum(kind, SLOT_NOTE_KINDS, 'type de remarque'), text(content, 'remarque', 2000))
  return db.prepare('SELECT * FROM journal_slot_notes WHERE id = ?').get(lastInsertRowid) as JournalSlotNote
}

export function deleteSlotNote(db: DB, noteId: number): void {
  db.prepare('DELETE FROM journal_slot_notes WHERE id = ?').run(assertId(noteId))
}

// ------------------------------------------------------------------ Note de la journée

export function getDayNote(db: DB, classId: number, date: string): string {
  const row = db
    .prepare('SELECT content FROM journal_day_notes WHERE class_id = ? AND date = ?')
    .get(classId, assertDate(date)) as { content: string } | undefined
  return row?.content ?? ''
}

export function setDayNote(db: DB, classId: number, date: string, content: string): void {
  assertDate(date)
  const value = text(content, 'note du jour')
  if (value.trim() === '') {
    db.prepare('DELETE FROM journal_day_notes WHERE class_id = ? AND date = ?').run(classId, date)
  } else {
    db.prepare(
      `INSERT INTO journal_day_notes (class_id, date, content) VALUES (?, ?, ?)
       ON CONFLICT(class_id, date) DO UPDATE SET content = excluded.content`
    ).run(classId, date, value)
  }
}
