import type { DinaBridge } from '../shared/ipc'

declare global {
  interface Window {
    dina: DinaBridge
  }
}
