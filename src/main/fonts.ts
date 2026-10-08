import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { copyFile, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { dialog, type BrowserWindow } from 'electron'
import type { CustomFont } from '@shared/types'

/**
 * Police cursive personnelle (ex. Belle Allure, dont la licence interdit la
 * redistribution) : l'enseignant importe son propre fichier, copié dans le
 * dossier de l'application et chargé localement.
 */
export class FontStore {
  constructor(private readonly dir: string) {}

  private file(): string | null {
    if (!existsSync(this.dir)) return null
    const f = readdirSync(this.dir).find((n) => /\.(ttf|otf|woff2?)$/i.test(n))
    return f ? join(this.dir, f) : null
  }

  async get(): Promise<CustomFont | null> {
    const f = this.file()
    if (!f) return null
    return { name: basename(f, extname(f)), data: new Uint8Array(await readFile(f)) }
  }

  async import(parent: BrowserWindow): Promise<CustomFont | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog(parent, {
      title: 'Importer une police cursive',
      properties: ['openFile'],
      filters: [{ name: 'Polices', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
    })
    if (canceled || !filePaths[0]) return null
    this.remove()
    mkdirSync(this.dir, { recursive: true })
    await copyFile(filePaths[0], join(this.dir, basename(filePaths[0])))
    return this.get()
  }

  remove(): void {
    const f = this.file()
    if (f) rmSync(f)
  }
}
