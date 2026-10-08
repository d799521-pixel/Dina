import { useEffect, useState } from 'react'
import type { SlotImage } from '@shared/types'

/**
 * Réduit une photo (appareil de l'iPad, capture, image de manuel) avant de
 * l'enregistrer : 1600 px maximum, JPEG. Une photo de 4 Mo tombe vers 200-400 Ko.
 */
export async function compressImage(file: File, max = 1600): Promise<{ mime: string; data: Uint8Array }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/jpeg', 0.82)
  )
  return { mime: 'image/jpeg', data: new Uint8Array(await blob.arrayBuffer()) }
}

/** Ouvre le sélecteur de photos (photothèque, appareil photo ou fichiers sur iPad). */
export function pickImages(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)
    const done = (files: File[]): void => {
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => done(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => done([]))
    input.click()
  })
}

/** URL affichables pour des images stockées en base. */
export function useImageUrls(images: Pick<SlotImage, 'id' | 'mime' | 'data'>[]): Map<number, string> {
  const [urls, setUrls] = useState(new Map<number, string>())
  useEffect(() => {
    const map = new Map(images.map((i) => [i.id, URL.createObjectURL(new Blob([new Uint8Array(i.data)], { type: i.mime }))]))
    setUrls(map)
    return () => map.forEach((u) => URL.revokeObjectURL(u))
  }, [images])
  return urls
}

export function toDataUrl(image: Pick<SlotImage, 'mime' | 'data'>): string {
  let s = ''
  const bytes = image.data
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${image.mime};base64,${btoa(s)}`
}
