import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { parseISODate } from '@shared/date'

export const fmt = (isoDate: string, pattern: string): string => format(parseISODate(isoDate), pattern, { locale: fr })

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** « Jeudi 8 octobre 2026 » */
export const longDate = (d: string): string => cap(fmt(d, 'EEEE d MMMM yyyy'))

/** « 08:30 » → « 8h30 » */
export const frTime = (t: string): string => {
  const [h, m] = t.split(':')
  return `${Number(h)}h${m === '00' ? '' : m}`
}

/** Couleur hexadécimale avec transparence (#rrggbb + alpha 0–1). */
export const alpha = (hex: string | null, a: number): string =>
  `${hex ?? '#64748b'}${Math.round(a * 255).toString(16).padStart(2, '0')}`
