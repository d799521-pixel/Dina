// Échanges de fichiers sur iPad : téléchargement vers l'app Fichiers et sélection d'un fichier.

export function downloadFile(content: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Ouvre le sélecteur de fichiers (doit être appelé pendant un geste de l'utilisateur). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    document.body.appendChild(input)
    const done = (f: File | null): void => {
      input.remove()
      resolve(f)
    }
    input.addEventListener('change', () => done(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => done(null))
    input.click()
  })
}
