import { readFile, writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { today } from '@shared/date'
import type { Channel, IpcContract, IpcResult } from '@shared/ipc'
import type { DbManager } from './db/manager'
import type { FontStore } from './fonts'
import type { ProjectionController } from './projection'
import { createBackup, readBackup, restoreBackup } from './services/backup'
import { exportPdf } from './services/pdf'
import { exportStudentData } from './services/students'
import { dataHandlers, type Handler } from './handlers'


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

  for (const [channel, fn] of Object.entries(dataHandlers(db, cls))) {
    handle(channel as Channel, fn as Handler<Channel>)
  }

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

  handle('pdf:export', (html, name) => exportPdf(parent(), html, name))

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
