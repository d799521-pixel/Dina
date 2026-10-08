import type { Channel, IpcContract } from '@shared/ipc'
import type { DB } from './db/types'
import * as appointments from './repositories/appointments'
import * as journal from './repositories/journal'
import * as prep from './repositories/preparations'
import * as ref from './repositories/referentials'
import { getAppSettings, updateAppSettings } from './repositories/settings'
import * as students from './repositories/students'
import * as timetable from './repositories/timetable'
import { startOfWeek } from '@shared/date'
import { eraseStudent } from './services/students'

export type Handler<C extends Channel> = (
  ...args: Parameters<IpcContract[C]>
) => ReturnType<IpcContract[C]> | Promise<ReturnType<IpcContract[C]>>

export type HandlerMap = { [C in Channel]?: Handler<C> }

/**
 * Canaux qui ne dépendent que de la base de données. Partagés tels quels entre
 * l'application de bureau (IPC Electron) et la version iPad (navigateur).
 */
export function dataHandlers(db: () => DB, cls: () => number): HandlerMap {
  return {
    'settings:get': () => getAppSettings(db()),
    'settings:update': (patch) => updateAppSettings(db(), patch),

    'ref:subjects': () => ref.listSubjects(db()),
    'ref:socle': () => ref.listSocleDomains(db()),
    'ref:lessons': () => ref.listLessonSummaries(db(), cls()),
    'ref:students': () => ref.listStudentSummaries(db(), cls()),

    'journal:range': (from, to) => journal.listSlots(db(), cls(), from, to),
    'journal:create': (input) => journal.createSlot(db(), cls(), input),
    'journal:update': (id, patch) => journal.updateSlot(db(), cls(), id, patch),
    'journal:delete': (id) => journal.deleteSlot(db(), cls(), id),
    'journal:notes': (slotId) => journal.listSlotNotes(db(), slotId),
    'journal:add-note': (slotId, kind, content) => journal.addSlotNote(db(), slotId, kind, content),
    'journal:delete-note': (noteId) => journal.deleteSlotNote(db(), noteId),
    'journal:day-note': (date) => journal.getDayNote(db(), cls(), date),
    'journal:set-day-note': (date, content) => journal.setDayNote(db(), cls(), date, content),

    'timetable:get': () => timetable.getTimetable(db(), cls()),
    'timetable:save-week': (weekStart) => timetable.saveWeekAsTimetable(db(), cls(), startOfWeek(weekStart)),
    'timetable:apply-week': (weekStart) =>
      timetable.applyTimetableToWeek(db(), cls(), startOfWeek(weekStart), getAppSettings(db()).school_days),

    'appointments:range': (from, to) => appointments.listAppointments(db(), cls(), from, to),
    'appointments:create': (input) => appointments.createAppointment(db(), cls(), input),
    'appointments:update': (id, input) => appointments.updateAppointment(db(), cls(), id, input),
    'appointments:delete': (id) => appointments.deleteAppointment(db(), cls(), id),

    'periods:list': () => prep.listClassPeriods(db(), cls()),
    'periods:update': (id, input) => prep.updatePeriod(db(), cls(), id, input),

    'sequences:list': () => prep.listSequences(db(), cls()),
    'sequences:create': (input) => prep.createSequence(db(), cls(), input),
    'sequences:update': (id, input) => prep.updateSequence(db(), cls(), id, input),
    'sequences:delete': (id) => prep.deleteSequence(db(), cls(), id),

    'lessons:of-sequence': (sequenceId) => prep.listSequenceLessons(db(), cls(), sequenceId),
    'lessons:get': (id) => prep.getLesson(db(), cls(), id),
    'lessons:create': (input) => prep.createLesson(db(), cls(), input),
    'lessons:update': (id, input) => prep.updateLesson(db(), cls(), id, input),
    'lessons:duplicate': (id) => prep.duplicateLesson(db(), cls(), id),
    'lessons:delete': (id) => prep.deleteLesson(db(), cls(), id),

    'programming:list': () => prep.listProgramming(db(), cls()),
    'programming:create': (input) => prep.createProgrammingItem(db(), cls(), input),
    'programming:update': (id, input) => prep.updateProgrammingItem(db(), cls(), id, input),
    'programming:move': (id, direction) => prep.moveProgrammingItem(db(), cls(), id, direction),
    'programming:delete': (id) => prep.deleteProgrammingItem(db(), cls(), id),
    'programming:to-sequence': (id) => prep.sequenceFromProgramming(db(), cls(), id),

    'students:list': (includeLeft) => students.listStudents(db(), cls(), includeLeft),
    'students:get': (id) => students.getStudentFile(db(), cls(), id),
    'students:save': (file) => students.saveStudentFile(db(), cls(), file),
    'students:observations': (id) => students.listObservations(db(), cls(), id),
    'students:add-observation': (id, input) => students.addObservation(db(), cls(), id, input),
    'students:delete-observation': (id) => students.deleteObservation(db(), cls(), id),
    'students:appointments': (id) => students.listStudentAppointments(db(), cls(), id),
    'students:erase': (id) => eraseStudent(db(), cls(), id)
  }
}
