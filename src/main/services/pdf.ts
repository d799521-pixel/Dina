import { writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog } from 'electron'

/**
 * Rend un document HTML dans une fenêtre invisible (sans JavaScript, sans
 * preload, réseau déjà bloqué) puis l'enregistre en PDF : aucun service externe.
 */
export async function exportPdf(parent: BrowserWindow | undefined, html: string, defaultName: string): Promise<string | null> {
  if (typeof html !== 'string' || html.length > 5_000_000) throw new Error('Document invalide')
  const options = {
    title: 'Enregistrer en PDF',
    defaultPath: defaultName.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  }
  const { canceled, filePath } = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return null

  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true, spellcheck: false }
  })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } })
    await writeFile(filePath, pdf)
    return filePath
  } finally {
    win.destroy()
  }
}
