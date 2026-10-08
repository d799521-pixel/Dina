import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DB } from '../src/main/db/connection'
import { createClassWithYear } from '../src/main/repositories/classes'
import * as journal from '../src/main/repositories/journal'
import * as prep from '../src/main/repositories/preparations'
import * as students from '../src/main/repositories/students'
import { eraseStudent } from '../src/main/services/students'
import type { LessonInput, SequenceInput, StudentFile } from '../src/shared/types'

let dir: string
let db: DB
let classId: number

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dina-'))
  db = openDatabase(join(dir, 'test.db'), null)
  classId = createClassWithYear(db, '2026-2027', 'CE2', ['CE2']).id
})
afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

const subject = (short: string): number =>
  (db.prepare('SELECT id FROM subjects WHERE short_name = ?').get(short) as { id: number }).id

const seqInput = (over: Partial<SequenceInput> = {}): SequenceInput => ({
  subject_id: subject('Français'), period_id: prep.listClassPeriods(db, classId)[1].id, title: 'Le conte',
  levels: ["CE2"], socle_domain: "D1.1", general_objectives: 'Lire des contes', prerequisites: '',
  planned_sessions_count: 6, success_criteria: '', final_assessment: '', notes: '', ...over
})

const lessonInput = (over: Partial<LessonInput> = {}): LessonInput => ({
  sequence_id: null, subject_id: null, number_in_sequence: null, title: 'Découverte', specific_objective: 'Identifier les personnages',
  duration_min: 45, materials: '', success_criteria: '', differentiation: '', institutionalization: '', assessment: '', notes: '',
  steps: [
    { title: 'Lecture offerte', duration_min: 10, work_mode: 'collectif', teacher_role: 'Lit', student_activity: 'Écoutent', materials: '' },
    { title: 'Recherche', duration_min: 20, work_mode: 'binome', teacher_role: '', student_activity: 'Cherchent', materials: 'Album' }
  ],
  ...over
})

describe('préparations', () => {
  it('liste les 5 périodes de la classe et met à jour leurs dates', () => {
    const periods = prep.listClassPeriods(db, classId)
    expect(periods.map((p) => p.number)).toEqual([1, 2, 3, 4, 5])
    const p1 = prep.updatePeriod(db, classId, periods[0].id, { label: 'P1', start_date: '2026-09-01', end_date: '2026-10-17' })
    expect(p1.end_date).toBe('2026-10-17')
    expect(() => prep.updatePeriod(db, classId, periods[0].id, { label: 'P1', start_date: '2026-10-01', end_date: '2026-09-01' })).toThrow()
  })

  it('crée une séquence, numérote ses séances et enregistre le déroulement', () => {
    const seq = prep.createSequence(db, classId, seqInput())
    expect(seq.period_number).toBe(2)
    const l1 = prep.createLesson(db, classId, lessonInput({ sequence_id: seq.id }))
    const l2 = prep.createLesson(db, classId, lessonInput({ sequence_id: seq.id, title: 'Les lieux' }))
    expect([l1.number_in_sequence, l2.number_in_sequence]).toEqual([1, 2])
    expect(l1.subject_id).toBe(subject('Français')) // hérite de la séquence
    expect(l1.steps.map((s) => s.work_mode)).toEqual(['collectif', 'binome'])

    const updated = prep.updateLesson(db, classId, l1.id, { ...lessonInput({ sequence_id: seq.id }), steps: [l1.steps[1]] })
    expect(updated.steps).toHaveLength(1)
    expect(prep.listSequences(db, classId)[0].lessons_count).toBe(2)

    const copy = prep.duplicateLesson(db, classId, l2.id)
    expect(copy.number_in_sequence).toBe(3)
    expect(copy.steps).toHaveLength(2)
  })

  it('garde le cahier journal intact quand une séance ou une séquence est supprimée', () => {
    const seq = prep.createSequence(db, classId, seqInput())
    const lesson = prep.createLesson(db, classId, lessonInput({ sequence_id: seq.id }))
    const slot = journal.createSlot(db, classId, {
      date: '2026-11-03', start_time: '09:00', end_time: '10:00', subject_id: null, title: '', socle_domain: null, lesson_id: lesson.id
    })
    expect(prep.getLesson(db, classId, lesson.id).scheduled_dates).toEqual(['2026-11-03'])

    prep.deleteSequence(db, classId, seq.id)
    expect(prep.getLesson(db, classId, lesson.id).sequence_id).toBeNull()
    prep.deleteLesson(db, classId, lesson.id)
    const kept = journal.getSlot(db, slot.id)
    expect(kept.lesson_id).toBeNull()
    expect(kept.title).toBe('Découverte')
  })

  it('gère la programmation : ordre, déplacement et transformation en séquence', () => {
    const period = prep.listClassPeriods(db, classId)[0].id
    const base = { subject_id: subject('Maths'), period_id: period, sequence_id: null, description: '' }
    const a = prep.createProgrammingItem(db, classId, { ...base, title: 'Numération' })
    const b = prep.createProgrammingItem(db, classId, { ...base, title: 'Addition' })
    prep.moveProgrammingItem(db, classId, b.id, -1)
    expect(prep.listProgramming(db, classId).map((i) => i.title)).toEqual(['Addition', 'Numération'])

    const seq = prep.sequenceFromProgramming(db, classId, a.id)
    expect(seq.title).toBe('Numération')
    expect(prep.listProgramming(db, classId).find((i) => i.id === a.id)?.sequence_id).toBe(seq.id)
    expect(prep.sequenceFromProgramming(db, classId, a.id).id).toBe(seq.id) // idempotent
  })
})

describe('élèves', () => {
  const file = (over: Partial<StudentFile> = {}): StudentFile => ({
    id: null, last_name: 'Martin', first_name: 'Léa', birth_date: '2018-04-02', level: 'CE2', entry_date: null, leave_date: null,
    contacts: [{ full_name: 'Mme Martin', relation: 'Mère', phone: '0600000000', phone_alt: '', email: '', address: '', is_legal_guardian: 1, is_emergency: 1, can_pick_up: 1 }],
    authorizations: [{ kind: 'photo', granted: 0, signed_on: '2026-09-02', comment: '' }],
    health: { allergies: 'Arachide', has_pai: 1, pai_details: 'Trousse dans le placard', medical_notes: '' },
    accommodations: [{ type: 'PAP', start_date: '2026-09-01', end_date: null, details: 'Textes agrandis' }],
    ...over
  })

  it('crée, relit et modifie une fiche complète', () => {
    const saved = students.saveStudentFile(db, classId, file())
    expect(saved.id).toBeGreaterThan(0)
    expect(saved.contacts[0].full_name).toBe('Mme Martin')
    expect(saved.health.has_pai).toBe(1)

    const list = students.listStudents(db, classId)
    expect(list[0]).toMatchObject({ first_name: 'Léa', has_pai: 1, photo_ok: 0, accommodations: ['PAP'] })

    const edited = students.saveStudentFile(db, classId, { ...saved, contacts: [], accommodations: [] })
    expect(edited.contacts).toEqual([])
    expect(students.listStudents(db, classId)[0].accommodations).toEqual([])
  })

  it('masque les élèves partis sauf demande explicite', () => {
    students.saveStudentFile(db, classId, file({ leave_date: '2026-10-01' }))
    expect(students.listStudents(db, classId)).toHaveLength(0)
    expect(students.listStudents(db, classId, true)).toHaveLength(1)
  })

  it('refuse une fiche sans nom', () => {
    expect(() => students.saveStudentFile(db, classId, file({ last_name: ' ' }))).toThrow(/obligatoires/)
  })

  it("enregistre des observations et les efface avec l'élève", () => {
    const s = students.saveStudentFile(db, classId, file())
    students.addObservation(db, classId, s.id!, { date: '2026-10-08', category: 'lecture', content: 'Lit avec fluidité' })
    expect(students.listObservations(db, classId, s.id!)).toHaveLength(1)
    eraseStudent(db, classId, s.id!)
    expect(db.prepare('SELECT count(*) c FROM student_observations').get()).toEqual({ c: 0 })
    expect(db.prepare('SELECT count(*) c FROM student_health').get()).toEqual({ c: 0 })
  })
})

describe('référentiel maternelle', () => {
  it('rattache chaque objectif du programme à un domaine', () => {
    const total = db.prepare('SELECT count(*) AS c FROM competencies').get() as { c: number }
    const orphan = db.prepare('SELECT count(*) AS c FROM competencies WHERE subject_id IS NULL').get() as { c: number }
    expect(total.c).toBeGreaterThan(350)
    expect(orphan.c).toBe(0)
    const levels = db.prepare('SELECT DISTINCT level FROM competencies ORDER BY level').all()
    expect(levels).toEqual([{ level: 'GS' }, { level: 'MS' }, { level: 'PS' }])
  })
})

describe('cahier journal : groupes, activités et photos', () => {
  it('enregistre le groupe, les activités et des photos (incluses dans la sauvegarde)', async () => {
    const { createPayload, restoreBackup } = await import('../src/main/services/backupCore')
    const slot = journal.createSlot(db, classId, {
      date: '2026-10-09', start_time: '09:05', end_time: '09:35', subject_id: null, title: 'Atelier dirigé avec PE',
      socle_domain: null, lesson_id: null, audience: 'GS', activities: 'Dénombrer des quantités jusqu’à 5'
    })
    expect(slot).toMatchObject({ audience: 'GS', activities: 'Dénombrer des quantités jusqu’à 5', images_count: 0 })
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])
    journal.addSlotImage(db, classId, slot.id, { mime: 'image/jpeg', data: bytes })
    expect(journal.getSlot(db, slot.id).images_count).toBe(1)
    expect(Array.from(journal.listSlotImages(db, classId, slot.id)[0].data)).toEqual(Array.from(bytes))
    expect(() => journal.addSlotImage(db, classId, slot.id, { mime: 'text/html', data: bytes })).toThrow()

    const payload = JSON.parse(JSON.stringify(createPayload(db)))
    journal.deleteSlot(db, classId, slot.id)
    restoreBackup(db, payload)
    expect(Array.from(journal.listSlotImages(db, classId, slot.id)[0].data)).toEqual(Array.from(bytes))
  })

  it('applique un emploi du temps importé avec des créneaux en parallèle', async () => {
    const { replaceTimetable, applyTimetableToWeek } = await import('../src/main/repositories/timetable')
    replaceTimetable(db, classId, [
      { weekday: 5, start_time: '09:05', end_time: '09:35', subject: 'Multi-domaine', label: 'Ateliers avec ATSEM', audience: 'PS' },
      { weekday: 5, start_time: '09:05', end_time: '09:35', subject: 'Outils maths', label: 'Atelier dirigé avec PE', audience: 'GS' },
      { weekday: 5, start_time: '09:05', end_time: '09:35', subject: 'Langage', label: 'Atelier autonome', audience: 'GS' }
    ])
    expect(applyTimetableToWeek(db, classId, '2026-10-05', [5])).toBe(3)
    expect(applyTimetableToWeek(db, classId, '2026-10-05', [5])).toBe(0)
    const slots = journal.listSlots(db, classId, '2026-10-09', '2026-10-09')
    expect(slots.map((s) => s.audience)).toEqual(['GS', 'GS', 'PS'])
    expect(slots.find((s) => s.audience === 'PS')?.subject_short).toBe('Multi-domaine')
  })

  it('associe des objectifs du programme à une séquence', () => {
    const ids = (db.prepare('SELECT id FROM competencies LIMIT 3').all() as { id: number }[]).map((r) => r.id)
    const seq = prep.createSequence(db, classId, seqInput({ competency_ids: ids }))
    expect(seq.competency_ids).toEqual(ids)
    const updated = prep.updateSequence(db, classId, seq.id, { ...seqInput(), competency_ids: [ids[0]] })
    expect(updated.competency_ids).toEqual([ids[0]])
  })
})
