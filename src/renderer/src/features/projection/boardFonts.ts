import { useEffect, useState } from 'react'
import type { BoardFont } from '@shared/types'
import { call } from '@/lib/api'

export const CUSTOM_FAMILY = 'Dina Police perso'

export const BOARD_FONTS: Record<BoardFont, { family: string; label: string; uppercase?: boolean }> = {
  cursive: { family: 'Playwrite FR Moderne', label: 'Cursive' },
  script: { family: 'Andika', label: 'Script' },
  capitales: { family: 'Andika', label: 'Capitales', uppercase: true },
  dys: { family: 'OpenDyslexic', label: 'OpenDyslexic' },
  perso: { family: CUSTOM_FAMILY, label: 'Police perso' }
}

/** Charge la police importée par l'enseignant (ex. Belle Allure) depuis le disque local. */
export function useCustomFont(rev: number): string | null {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void call('fonts:get')
      .then(async (font) => {
        for (const f of [...document.fonts]) if (f.family === CUSTOM_FAMILY || f.family === `"${CUSTOM_FAMILY}"`) document.fonts.delete(f)
        if (!font) return !cancelled && setName(null)
        const face = await new FontFace(CUSTOM_FAMILY, new Uint8Array(font.data)).load()
        document.fonts.add(face)
        if (!cancelled) setName(font.name)
      })
      .catch(() => !cancelled && setName(null))
    return () => {
      cancelled = true
    }
  }, [rev])
  return name
}

const ratioCache = new Map<string, number>()

/**
 * Mesure la hauteur d'x (ou des capitales) d'une police, rapportée à sa taille.
 * Sert à caler précisément les minuscules sur un ou deux interlignes Seyès.
 */
export function useGlyphRatio(family: string, uppercase: boolean, rev = 0): number {
  const key = `${family}|${uppercase}|${rev}`
  const [ratio, setRatio] = useState(() => ratioCache.get(key) ?? (uppercase ? 0.7 : 0.45))
  useEffect(() => {
    let cancelled = false
    const measure = (): void => {
      const ctx = document.createElement('canvas').getContext('2d')!
      ctx.font = `200px "${family}"`
      const m = ctx.measureText(uppercase ? 'H' : 'x')
      const r = m.actualBoundingBoxAscent / 200
      if (r > 0.05) {
        ratioCache.set(key, r)
        if (!cancelled) setRatio(r)
      }
    }
    void document.fonts.load(`200px "${family}"`, 'xH').then(measure, measure)
    return () => {
      cancelled = true
    }
  }, [family, uppercase, key])
  return ratio
}
