import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CHANNELS, type DinaBridge, type IpcEvents } from '@shared/ipc'

const EVENTS: readonly (keyof IpcEvents)[] = ['projection:state', 'projection:window']

const bridge: DinaBridge = {
  invoke(channel, ...args) {
    if (!CHANNELS.includes(channel)) return Promise.reject(new Error(`Canal interdit : ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  on(event, listener) {
    if (!EVENTS.includes(event)) throw new Error(`Événement interdit : ${event}`)
    const wrapped = (_e: IpcRendererEvent, payload: any): void => listener(payload)
    ipcRenderer.on(event, wrapped)
    return () => ipcRenderer.removeListener(event, wrapped)
  }
}

contextBridge.exposeInMainWorld('dina', bridge)
