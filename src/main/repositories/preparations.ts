import {
  WORK_MODES,
  type Lesson,
  type LessonHeader,
  type LessonInput,
  type LessonStep,
  type Period,
  type PeriodInput,
  type ProgrammingItem,
  type ProgrammingItemInput,
  type SequenceInput,
  type SequenceListItem
} from '@shared/types'
import type { DB } from '../db/types'
import { assertDate, assertEnum, assertId, optionalId, text, ValidationError } from '../validation'

const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

const optionalInt = (v: unknown, field: string): number | null => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10_000) throw new ValidationError(`${field} invalide`)
  return v
}

const optionalDate = (v: unknown, field: string): string | null => (v ? assertDate(v, field) : null)

const requiredTitle = (v: unknown): string => {
  const t = text(v, 'titre', 300).trim()
  if (!t) throw new ValidationError('Le titre est obligatoire')
  return t
}

// ------------------------------------------------------------------ Périodes

export function listClassPeriods(db: DB, classId: number): Period[] {
  return db
    .prepare(
      `SELECT p.* FROM periods p JOIN classes c ON c.school_year_id = p.school_year_id
        WHERE c.id = ? ORDER BY p.number`
    )
    .all(classId) as Period[]
}

export function updatePeriod(db: DB, classId: number, id: number, input: PeriodInput): Period {
  const start = optionalDate(input.start_date, 'date de début')
  const end = optionalDate(input.end_date, 'date de fin')
  if (start && end && start > end) throw new ValidationError('La période se termine avant de commencer')
  const { changes } = db
    .prepare(
      `UPDATE periods SET label = ?, start_date = ?, end_date = ?
        WHERE id = ? AND school_year_id = (SELECT school_year_id FROM classes WHERE id = ?)`
    )
    .run(text(input.label, 'libellé', 100).trim() || 'Période', start, end, assertId(id), classId)
  if (changes === 0) throw new ValidationError('Période introuvable')
  return db.prepare('SELECT * FROM periods WHERE id = ?').get(id) as Period
}

// ------------------------------------------------------------------ Séquences

type SequenceRow = Omit<SequenceListItem, 'levels'> & { levels: string }

const SEQUENCE_LIST = /* sql */ `
  SELECT s.*, sub.name AS subject_name, sub.short_name AS subject_short, sub.color AS subject_color,
         sub.icon AS subject_icon, p.number AS period_number,
         (SELECT count(*) FROM lessons l WHERE l.sequence_id = s.id) AS lessons_count
    FROM sequences s
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    LEFT JOIN periods p ON p.id = s.period_id`

const toSequence = (r: SequenceRow): SequenceListItem => ({ ...r, levels: JSON.parse(r.levels) as string[] })

export function listSequences(db: DB, classId: number): SequenceListItem[] {
  return (
    db
      .prepare(`${SEQUENCE_LIST} WHERE s.class_id = ? ORDER BY p.number IS NULL, p.number, sub.position, s.title`)
      .all(classId) as SequenceRow[]
  ).map(toSequence)
}

export function getSequence(db: DB, classId: number, id: number): SequenceListItem {
  const row = db.prepare(`${SEQUENCE_LIST} WHERE s.id = ? AND s.class_id = ?`).get(assertId(id), classId) as
    | SequenceRow
    | undefined
  if (!row) throw new ValidationError('Séquence introuvable')
  return toSequence(row)
}

function sequenceValues(input: SequenceInput): unknown[] {
  return [
    optionalId(input.subject_id, 'matière'),
    optionalId(input.period_id, 'période'),
    requiredTitle(input.title),
    JSON.stringify(Array.isArray(input.levels) ? input.levels.map(String) : []),
    input.socle_domain || null,
    text(input.general_objectives, 'objectifs'),
    text(input.prerequisites, 'prérequis'),
    optionalInt(input.planned_sessions_count, 'nombre de séances'),
    text(input.success_criteria, 'critères de réussite'),
    text(input.final_assessment, 'évaluation'),
    text(input.notes, 'notes')
  ]
}

export function createSequence(db: DB, classId: number, input: SequenceInput): SequenceListItem {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO sequences (class_id, subject_id, period_id, title, levels, socle_domain, general_objectives,
                              prerequisites, planned_sessions_count, success_criteria, final_assessment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(classId, ...sequenceValues(input))
  return getSequence(db, classId, Number(lastInsertRowid))
}

export function updateSequence(db: DB, classId: number, id: number, input: SequenceInput): SequenceListItem {
  const { changes } = db
    .prepare(
      `UPDATE sequences SET subject_id = ?, period_id = ?, title = ?, levels = ?, socle_domain = ?,
              general_objectives = ?, prerequisites = ?, planned_sessions_count = ?, success_criteria = ?,
              final_assessment = ?, notes = ?, updated_at = ${now}
        WHERE id = ? AND class_id = ?`
    )
    .run(...sequenceValues(input), assertId(id), classId)
  if (changes === 0) throw new ValidationError('Séquence introuvable')
  // Les séances suivent la matière de leur séquence.
  db.prepare('UPDATE lessons SET subject_id = ? WHERE sequence_id = ?').run(optionalId(input.subject_id), id)
  return getSequence(db, classId, id)
}

/** Supprime la séquence ; ses séances deviennent « hors séquence » (rien n'est perdu). */
export function deleteSequence(db: DB, classId: number, id: number): void {
  db.prepare('DELETE FROM sequences WHERE id = ? AND class_id = ?').run(assertId(id), classId)
}

// ------------------------------------------------------------------ Séances

type LessonRow = LessonHeader

export function listSequenceLessons(db: DB, classId: number, sequenceId: number | null): LessonRow[] {
  return db
    .prepare(
      `SELECT * FROM lessons WHERE class_id = ? AND sequence_id IS ?
        ORDER BY number_in_sequence IS NULL, number_in_sequence, title`
    )
    .all(classId, sequenceId) as LessonRow[]
}

export function getLesson(db: DB, classId: number, id: number): Lesson {
  const row = db.prepare('SELECT * FROM lessons WHERE id = ? AND class_id = ?').get(assertId(id), classId) as
    | LessonRow
    | undefined
  if (!row) throw new ValidationError('Séance introuvable')
  const steps = db
    .prepare(
      `SELECT id, title, duration_min, work_mode, teacher_role, student_activity, materials
         FROM lesson_steps WHERE lesson_id = ? ORDER BY position`
    )
    .all(id) as LessonStep[]
  const scheduled = db
    .prepare('SELECT DISTINCT date FROM journal_slots WHERE lesson_id = ? ORDER BY date')
    .all(id) as { date: string }[]
  return { ...row, steps, scheduled_dates: scheduled.map((r) => r.date) }
}

function sequenceSubject(db: DB, classId: number, sequenceId: number | null): number | null | undefined {
  if (sequenceId === null) return undefined
  const row = db.prepare('SELECT subject_id FROM sequences WHERE id = ? AND class_id = ?').get(sequenceId, classId) as
    | { subject_id: number | null }
    | undefined
  if (!row) throw new ValidationError('Séquence introuvable')
  return row.subject_id
}

function saveSteps(db: DB, lessonId: number, steps: LessonStep[]): void {
  if (!Array.isArray(steps) || steps.length > 50) throw new ValidationError('Déroulement invalide')
  db.prepare('DELETE FROM lesson_steps WHERE lesson_id = ?').run(lessonId)
  const insert = db.prepare(
    `INSERT INTO lesson_steps (lesson_id, position, title, duration_min, work_mode, teacher_role, student_activity, materials)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  steps.forEach((s, i) =>
    insert.run(
      lessonId,
      i + 1,
      text(s.title, 'étape', 300).trim() || `Étape ${i + 1}`,
      optionalInt(s.duration_min, 'durée'),
      assertEnum(s.work_mode, WORK_MODES, 'modalité'),
      text(s.teacher_role, 'rôle de l’enseignant'),
      text(s.student_activity, 'activité des élèves'),
      text(s.materials, 'matériel', 2000)
    )
  )
}

function lessonValues(db: DB, classId: number, input: LessonInput): unknown[] {
  const sequenceId = optionalId(input.sequence_id, 'séquence')
  const seqSubject = sequenceSubject(db, classId, sequenceId)
  return [
    sequenceId,
    seqSubject !== undefined ? seqSubject : optionalId(input.subject_id, 'matière'),
    optionalInt(input.number_in_sequence, 'numéro'),
    requiredTitle(input.title),
    text(input.specific_objective, 'objectif'),
    optionalInt(input.duration_min, 'durée'),
    text(input.materials, 'matériel'),
    text(input.success_criteria, 'critères de réussite'),
    text(input.differentiation, 'différenciation'),
    text(input.institutionalization, 'institutionnalisation'),
    text(input.assessment, 'évaluation'),
    text(input.notes, 'notes')
  ]
}

export function createLesson(db: DB, classId: number, input: LessonInput): Lesson {
  return db.transaction(() => {
    const values = lessonValues(db, classId, input)
    // Numérotation automatique à la suite des séances existantes de la séquence.
    if (values[2] === null && values[0] !== null) {
      const { n } = db.prepare('SELECT coalesce(max(number_in_sequence), 0) + 1 AS n FROM lessons WHERE sequence_id = ?').get(values[0]) as { n: number }
      values[2] = n
    }
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO lessons (sequence_id, subject_id, number_in_sequence, title, specific_objective, duration_min,
                              materials, success_criteria, differentiation, institutionalization, assessment, notes, class_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(...values, classId)
    const id = Number(lastInsertRowid)
    saveSteps(db, id, input.steps ?? [])
    return getLesson(db, classId, id)
  })()
}

export function updateLesson(db: DB, classId: number, id: number, input: LessonInput): Lesson {
  return db.transaction(() => {
    const { changes } = db
      .prepare(
        `UPDATE lessons SET sequence_id = ?, subject_id = ?, number_in_sequence = ?, title = ?, specific_objective = ?,
                duration_min = ?, materials = ?, success_criteria = ?, differentiation = ?, institutionalization = ?,
                assessment = ?, notes = ?, updated_at = ${now}
          WHERE id = ? AND class_id = ?`
      )
      .run(...lessonValues(db, classId, input), assertId(id), classId)
    if (changes === 0) throw new ValidationError('Séance introuvable')
    saveSteps(db, id, input.steps ?? [])
    // Les créneaux du journal liés suivent la séquence de la séance.
    db.prepare('UPDATE journal_slots SET sequence_id = ? WHERE lesson_id = ?').run(optionalId(input.sequence_id), id)
    return getLesson(db, classId, id)
  })()
}

export function duplicateLesson(db: DB, classId: number, id: number): Lesson {
  const { id: _id, class_id: _c, created_at: _a, updated_at: _u, scheduled_dates: _d, ...input } = getLesson(db, classId, id)
  return createLesson(db, classId, {
    ...input,
    title: `${input.title} (copie)`,
    number_in_sequence: null,
    steps: input.steps.map(({ id: _s, ...s }) => s)
  })
}

export function deleteLesson(db: DB, classId: number, id: number): void {
  db.prepare('DELETE FROM lessons WHERE id = ? AND class_id = ?').run(assertId(id), classId)
}

// ------------------------------------------------------------------ Programmation annuelle

export function listProgramming(db: DB, classId: number): ProgrammingItem[] {
  return db
    .prepare('SELECT * FROM programming_items WHERE class_id = ? ORDER BY subject_id, period_id, position, id')
    .all(classId) as ProgrammingItem[]
}

function programmingValues(input: ProgrammingItemInput): unknown[] {
  return [
    optionalId(input.subject_id, 'matière'),
    optionalId(input.period_id, 'période'),
    optionalId(input.sequence_id, 'séquence'),
    requiredTitle(input.title),
    text(input.description, 'description', 5000)
  ]
}

export function createProgrammingItem(db: DB, classId: number, input: ProgrammingItemInput): ProgrammingItem {
  const values = programmingValues(input)
  const { p } = db
    .prepare(
      'SELECT coalesce(max(position), 0) + 1 AS p FROM programming_items WHERE class_id = ? AND subject_id IS ? AND period_id IS ?'
    )
    .get(classId, values[0], values[1]) as { p: number }
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO programming_items (subject_id, period_id, sequence_id, title, description, class_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values, classId, p)
  return db.prepare('SELECT * FROM programming_items WHERE id = ?').get(lastInsertRowid) as ProgrammingItem
}

export function updateProgrammingItem(db: DB, classId: number, id: number, input: ProgrammingItemInput): ProgrammingItem {
  const { changes } = db
    .prepare(
      `UPDATE programming_items SET subject_id = ?, period_id = ?, sequence_id = ?, title = ?, description = ?
        WHERE id = ? AND class_id = ?`
    )
    .run(...programmingValues(input), assertId(id), classId)
  if (changes === 0) throw new ValidationError('Élément introuvable')
  return db.prepare('SELECT * FROM programming_items WHERE id = ?').get(id) as ProgrammingItem
}

/** Déplace un élément d'un cran dans sa case (progression). */
export function moveProgrammingItem(db: DB, classId: number, id: number, direction: -1 | 1): void {
  db.transaction(() => {
    const item = db.prepare('SELECT * FROM programming_items WHERE id = ? AND class_id = ?').get(assertId(id), classId) as
      | ProgrammingItem
      | undefined
    if (!item) throw new ValidationError('Élément introuvable')
    const siblings = db
      .prepare(
        'SELECT id FROM programming_items WHERE class_id = ? AND subject_id IS ? AND period_id IS ? ORDER BY position, id'
      )
      .all(classId, item.subject_id, item.period_id) as { id: number }[]
    const ids = siblings.map((s) => s.id)
    const from = ids.indexOf(id)
    const to = from + direction
    if (to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    const update = db.prepare('UPDATE programming_items SET position = ? WHERE id = ?')
    ids.forEach((x, i) => update.run(i + 1, x))
  })()
}

export function deleteProgrammingItem(db: DB, classId: number, id: number): void {
  db.prepare('DELETE FROM programming_items WHERE id = ? AND class_id = ?').run(assertId(id), classId)
}

/** Transforme un élément de programmation en séquence (même matière, même période) et les relie. */
export function sequenceFromProgramming(db: DB, classId: number, id: number): SequenceListItem {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM programming_items WHERE id = ? AND class_id = ?').get(assertId(id), classId) as
      | ProgrammingItem
      | undefined
    if (!item) throw new ValidationError('Élément introuvable')
    if (item.sequence_id) return getSequence(db, classId, item.sequence_id)
    const seq = createSequence(db, classId, {
      subject_id: item.subject_id,
      period_id: item.period_id,
      title: item.title,
      levels: [],
      socle_domain: null,
      general_objectives: item.description,
      prerequisites: '',
      planned_sessions_count: null,
      success_criteria: '',
      final_assessment: '',
      notes: ''
    })
    db.prepare('UPDATE programming_items SET sequence_id = ? WHERE id = ?').run(seq.id, id)
    return seq
  })()
}
