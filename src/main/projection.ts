import { BrowserWindow, screen } from 'electron'
import { DEFAULT_PROJECTION, type ProjectionState } from '@shared/types'
import type { ProjectionPatch } from '@shared/ipc'

/**
 * État du tableau projeté. Il vit dans le processus principal et est diffusé
 * à toutes les fenêtres : le pupitre (fenêtre principale) le modifie, l'écran
 * projeté l'affiche. Le minuteur est décrit par une heure de fin absolue pour
 * que les deux fenêtres restent synchronisées sans échange continu.
 */
export class ProjectionController {
  private state: ProjectionState = structuredClone(DEFAULT_PROJECTION)
  private window: BrowserWindow | null = null

  constructor(
    private readonly createWindow: (opts: Electron.BrowserWindowConstructorOptions, hash: string) => BrowserWindow,
    private readonly persist: (s: ProjectionState) => void
  ) {}

  restore(saved: Partial<ProjectionState> | undefined): void {
    if (saved) this.state = { ...this.state, ...saved, timer: this.state.timer }
  }

  get(): ProjectionState {
    return this.state
  }

  set(patch: ProjectionPatch): ProjectionState {
    this.state = { ...this.state, ...patch, timer: { ...this.state.timer, ...patch.timer } }
    this.persist(this.state)
    this.broadcast('projection:state', this.state)
    return this.state
  }

  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed()
  }

  open(): void {
    if (this.isOpen()) {
      this.window!.focus()
      return
    }
    // Ouvre de préférence sur l'écran secondaire (vidéoprojecteur / TBI).
    const primary = screen.getPrimaryDisplay()
    const external = screen.getAllDisplays().find((d) => d.id !== primary.id)
    const target = external ?? primary
    const win = this.createWindow(
      {
        x: target.bounds.x + 40,
        y: target.bounds.y + 40,
        width: Math.min(1280, target.workArea.width - 80),
        height: Math.min(800, target.workArea.height - 80),
        fullscreen: Boolean(external),
        autoHideMenuBar: true,
        backgroundColor: '#ffffff',
        title: 'Dina — Tableau'
      },
      '/projection'
    )
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      if (input.key === 'F11' || input.key === 'f') {
        win.setFullScreen(!win.isFullScreen())
        event.preventDefault()
      } else if (input.key === 'Escape') {
        if (win.isFullScreen()) win.setFullScreen(false)
        else win.close()
        event.preventDefault()
      }
    })
    win.on('closed', () => {
      this.window = null
      this.broadcast('projection:window', false)
    })
    this.window = win
    this.broadcast('projection:window', true)
  }

  close(): void {
    if (this.isOpen()) this.window!.close()
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}
