import { readFile, writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { startOfWeek, today } from '@shared/date'
import type { Channel, IpcContract, IpcResult } from '@shared/ipc'
import type { DbManager } from './db/manager'
import type { FontStore } from './fonts'
import type { ProjectionController } from './projection'
import * as appointments from './repositories/appointments'
import * as journal from './repositories/journal'
import * as ref from './repositories/referentials'
import { getAppSettings, updateAppSettings } from './repositories/settings'
import * as timetable from './repositories/timetable'
import { createBackup, readBackup, restoreBackup } from './services/backup'
import { eraseStudent, exportStudentData } from './services/students'

type Handler<C extends Channel> = (...args: Parameters<IpcContract[C]>) => ReturnType<IpcContract[C]> | Promise<ReturnType<IpcContract[C]>>

/**
 * Enregistre un canal. Les erreurs sont renvoyées sous forme de valeur afin
 * que l'interface affiche un message lisible (et non une trace Electron).
 */
function handle<C extends Channel>(channel: C, fn: Handler<C>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<ReturnType<IpcContract[C]>>> => {
    try {
      return { ok: true, data: await fn(...(args as Parameters<IpcContract[C]>)) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!(err instanceof Error) || !['ValidationError', 'WrongPassphraseError'].includes(err.name)) {
        console.error(`[ipc:${channel}]`, err)
      }
      return { ok: false, error: message }
    }
  })
}

const stamp = (): string => today()

export function registerIpc(dbm: DbManager, projection: ProjectionController, fonts: FontStore): void {
  const db = () => dbm.get()
  const cls = () => dbm.classId()
  const parent = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  handle('db:status', () => dbm.status())
  handle('db:unlock', (p) => dbm.unlock(p))
  handle('db:setup', (input) => dbm.setup(input))
  handle('db:change-passphrase', (next) => dbm.changePassphrase(next))
  handle('db:lock', () => {
    projection.close()
    return dbm.lock()
  })

  handle('settings:get', () => getAppSettings(db()))
  handle('settings:update', (patch) => updateAppSettings(db(), patch))

  handle('ref:subjects', () => ref.listSubjects(db()))
  handle('ref:socle', () => ref.listSocleDomains(db()))
  handle('ref:lessons', () => ref.listLessonSummaries(db(), cls()))
  handle('ref:students', () => ref.listStudentSummaries(db(), cls()))

  handle('journal:range', (from, to) => journal.listSlots(db(), cls(), from, to))
  handle('journal:create', (input) => journal.createSlot(db(), cls(), input))
  handle('journal:update', (id, patch) => journal.updateSlot(db(), cls(), id, patch))
  handle('journal:delete', (id) => journal.deleteSlot(db(), cls(), id))
  handle('journal:notes', (slotId) => journal.listSlotNotes(db(), slotId))
  handle('journal:add-note', (slotId, kind, content) => journal.addSlotNote(db(), slotId, kind, content))
  handle('journal:delete-note', (noteId) => journal.deleteSlotNote(db(), noteId))
  handle('journal:day-note', (date) => journal.getDayNote(db(), cls(), date))
  handle('journal:set-day-note', (date, content) => journal.setDayNote(db(), cls(), date, content))

  handle('timetable:get', () => timetable.getTimetable(db(), cls()))
  handle('timetable:save-week', (weekStart) => timetable.saveWeekAsTimetable(db(), cls(), startOfWeek(weekStart)))
  handle('timetable:apply-week', (weekStart) =>
    timetable.applyTimetableToWeek(db(), cls(), startOfWeek(weekStart), getAppSettings(db()).school_days)
  )

  handle('appointments:range', (from, to) => appointments.listAppointments(db(), cls(), from, to))
  handle('appointments:create', (input) => appointments.createAppointment(db(), cls(), input))
  handle('appointments:update', (id, input) => appointments.updateAppointment(db(), cls(), id, input))
  handle('appointments:delete', (id) => appointments.deleteAppointment(db(), cls(), id))

  handle('students:export', async (id) => {
    const data = exportStudentData(db(), cls(), id)
    const { canceled, filePath } = await dialog.showSaveDialog(parent(), {
      title: 'Exporter les données de l’élève',
      defaultPath: `eleve-${id}-${stamp()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
    return filePath
  })
  handle('students:erase', (id) => eraseStudent(db(), cls(), id))

  handle('backup:export', async (passphrase) => {
    const envelope = createBackup(db(), passphrase)
    const { canceled, filePath } = await dialog.showSaveDialog(parent(), {
      title: 'Enregistrer une sauvegarde',
      defaultPath: `dina-sauvegarde-${stamp()}.dina.json`,
      filters: [{ name: 'Sauvegarde Dina', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, JSON.stringify(envelope), 'utf8')
    return filePath
  })
  handle('backup:import', async (passphrase) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(parent(), {
      title: 'Restaurer une sauvegarde',
      properties: ['openFile'],
      filters: [{ name: 'Sauvegarde Dina', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return false
    const payload = readBackup(JSON.parse(await readFile(filePaths[0], 'utf8')), passphrase)
    restoreBackup(db(), payload)
    return true
  })

  handle('projection:open', () => projection.open())
  handle('projection:close', () => projection.close())
  handle('projection:is-open', () => projection.isOpen())
  handle('projection:get', () => projection.get())
  handle('projection:set', (patch) => projection.set(patch))

  handle('fonts:get', () => fonts.get())
  handle('fonts:import', () => fonts.import(parent()))
  handle('fonts:remove', () => fonts.remove())
}
