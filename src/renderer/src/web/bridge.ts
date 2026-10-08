import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { today } from '@shared/date'
import type { Channel, DinaBridge, IpcEvents, ProjectionPatch } from '@shared/ipc'
import { DEFAULT_PROJECTION, type CustomFont, type ProjectionState } from '@shared/types'
import { dataHandlers, type HandlerMap } from '../../../main/handlers'
import { getSetting, setSetting } from '../../../main/repositories/settings'
import { createPayload, restoreBackup } from '../../../main/services/backupCore'
import { exportStudentData } from '../../../main/services/students'
import { downloadFile, pickFile } from './files'
import { idbDelete, idbGet, idbSet } from './idb'
import { showPrintable } from './print'
import { createBackupWeb, readBackupWeb } from './webCrypto'
import { WebDbManager } from './webDb'

/**
 * Remplace le pont Electron quand Dina tourne dans un navigateur (iPad) :
 * mêmes canaux, mêmes réponses, mais tout s'exécute dans la page.
 */
export async function installWebBridge(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const dbm = new WebDbManager(SQL)
  await dbm.init()

  const listeners = new Map<string, Set<(payload: never) => void>>()
  const emit = <E extends keyof IpcEvents>(event: E, payload: IpcEvents[E]): void =>
    listeners.get(event)?.forEach((l) => (l as (p: IpcEvents[E]) => void)(payload))

  // ------------------------------------------------------------------ Tableau
  let projection: ProjectionState = structuredClone(DEFAULT_PROJECTION)
  let projectionRestored = false
  let projectionOpen = false
  let persistTimer: ReturnType<typeof setTimeout> | undefined

  const restoreProjection = (): void => {
    if (projectionRestored) return
    try {
      const saved = getSetting<Partial<ProjectionState>>(dbm.get(), 'projection')
      if (saved) projection = { ...projection, ...saved, timer: projection.timer }
      projectionRestored = true
    } catch {
      /* base verrouillée */
    }
  }

  const setProjectionOpen = (open: boolean): void => {
    projectionOpen = open
    emit('projection:window', open)
  }

  const platform: HandlerMap = {
    'db:status': () => dbm.status(),
    'db:unlock': (p) => dbm.unlock(p),
    'db:setup': (input) => dbm.setup(input),
    'db:change-passphrase': (next) => dbm.changePassphrase(next),
    'db:lock': () => {
      setProjectionOpen(false)
      projectionRestored = false
      return dbm.lock()
    },

    'students:export': (id) => {
      const data = exportStudentData(dbm.get(), dbm.classId(), id)
      const name = `eleve-${id}-${today()}.json`
      downloadFile(JSON.stringify(data, null, 2), name, 'application/json')
      return name
    },

    'backup:export': async (passphrase) => {
      const envelope = await createBackupWeb(createPayload(dbm.get()), passphrase)
      const name = `dina-sauvegarde-${today()}.dina.json`
      downloadFile(JSON.stringify(envelope), name, 'application/json')
      return name
    },
    'backup:import': async (passphrase) => {
      const file = await pickFile('.json,application/json')
      if (!file) return false
      const payload = await readBackupWeb(JSON.parse(await file.text()), passphrase)
      restoreBackup(dbm.get(), payload)
      projectionRestored = false
      return true
    },

    'pdf:export': (html, name) => {
      showPrintable(html, name)
      return null
    },

    'projection:open': () => setProjectionOpen(true),
    'projection:close': () => setProjectionOpen(false),
    'projection:is-open': () => projectionOpen,
    'projection:get': () => {
      restoreProjection()
      return projection
    },
    'projection:set': (patch: ProjectionPatch) => {
      restoreProjection()
      projection = { ...projection, ...patch, timer: { ...projection.timer, ...patch.timer } }
      emit('projection:state', projection)
      clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        try {
          const { timer: _t, scene: _s, ...prefs } = projection
          setSetting(dbm.get(), 'projection', prefs)
          void dbm.persistIfChanged()
        } catch {
          /* base verrouillée */
        }
      }, 800)
      return projection
    },

    'fonts:get': () => idbGet<CustomFont>('font').then((f) => f ?? null),
    'fonts:import': async () => {
      const file = await pickFile('.ttf,.otf,.woff,.woff2')
      if (!file) return null
      const font: CustomFont = { name: file.name.replace(/\.[^.]+$/, ''), data: new Uint8Array(await file.arrayBuffer()) }
      await idbSet('font', font)
      return font
    },
    'fonts:remove': async () => {
      await idbDelete('font')
    }
  }

  const handlers: HandlerMap = { ...dataHandlers(() => dbm.get(), () => dbm.classId()), ...platform }

  const bridge: DinaBridge = {
    platform: 'web',
    async invoke(channel, ...args) {
      const fn = handlers[channel as Channel] as ((...a: unknown[]) => unknown) | undefined
      if (!fn) return { ok: false, error: `Canal inconnu : ${channel}` }
      try {
        const data = await fn(...args)
        await dbm.persistIfChanged()
        return { ok: true, data } as never
      } catch (err) {
        if (!(err instanceof Error) || !['ValidationError', 'WrongPassphraseError'].includes(err.name)) console.error(channel, err)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set()
      set.add(listener as (payload: never) => void)
      listeners.set(event, set)
      return () => set.delete(listener as (payload: never) => void)
    }
  }
  window.dina = bridge

  // Enregistre avant que l'iPad ne mette l'application en arrière-plan.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void dbm.persistIfChanged()
  })
}
