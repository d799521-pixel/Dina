import { join } from 'node:path'
import { app, BrowserWindow, Menu } from 'electron'
import type { ProjectionState } from '@shared/types'
import { DbManager } from './db/manager'
import { FontStore } from './fonts'
import { registerIpc } from './ipc'
import { ProjectionController } from './projection'
import { getSetting, setSetting } from './repositories/settings'
import { hardenSession } from './security'

const DEV_URL = process.env['ELECTRON_RENDERER_URL']

// Dossier de données : version portable (clé USB) → à côté de l'exécutable ;
// sinon DINA_DATA_DIR si défini ; sinon le dossier utilisateur standard.
const dataDir = process.env['PORTABLE_EXECUTABLE_DIR']
  ? join(process.env['PORTABLE_EXECUTABLE_DIR'], 'Dina-donnees')
  : process.env['DINA_DATA_DIR']
if (dataDir) app.setPath('userData', dataDir)

// Aucune donnée ne quitte le poste : pas de rapport de plantage, pas de mise à jour automatique.
// Interface en français (formats de date et d'heure des champs natifs).
app.commandLine.appendSwitch('lang', 'fr-FR')
app.commandLine.appendSwitch('disable-features', 'Translate,SpareRendererForSitePerProcess,AutofillServerCommunication')

function createWindow(options: Electron.BrowserWindowConstructorOptions, hash = '/'): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    ...options,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      webSecurity: true
    }
  })
  win.once('ready-to-show', () => win.show())
  if (DEV_URL) void win.loadURL(`${DEV_URL}#${hash}`)
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'), { hash })
  return win
}

void app.whenReady().then(() => {
  hardenSession(DEV_URL)
  if (!DEV_URL) Menu.setApplicationMenu(null)

  const dbm = new DbManager(join(app.getPath('userData'), 'dina.db'))
  try {
    dbm.tryAutoOpen()
  } catch (err) {
    console.error('Ouverture de la base impossible', err)
  }

  let persistTimer: NodeJS.Timeout | undefined
  const projection = new ProjectionController(createWindow, (state) => {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      try {
        const { timer: _timer, scene: _scene, ...prefs } = state
        setSetting(dbm.get(), 'projection', prefs)
      } catch {
        /* base verrouillée : préférences non enregistrées */
      }
    }, 800)
  })
  const restoreProjection = (): void => {
    try {
      projection.restore(getSetting<Partial<ProjectionState>>(dbm.get(), 'projection'))
    } catch {
      /* base pas encore ouverte */
    }
  }
  restoreProjection()

  registerIpc(dbm, projection, new FontStore(join(app.getPath('userData'), 'fonts')))

  const main = createWindow({ width: 1360, height: 860, minWidth: 1024, minHeight: 680, title: 'Dina' })
  main.on('closed', () => {
    projection.close()
  })
  main.webContents.on('did-finish-load', restoreProjection)

  app.on('before-quit', () => dbm.close())
})

app.on('window-all-closed', () => app.quit())
