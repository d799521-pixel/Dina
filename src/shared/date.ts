// Utilitaires de dates « calendaires » (YYYY-MM-DD) indépendants du fuseau horaire.

const pad = (n: number): string => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12) // midi : évite les décalages liés à l'heure d'été
}

export function today(): string {
  return toISODate(new Date())
}

export function addDays(s: string, days: number): string {
  const d = parseISODate(s)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(s: string): number {
  const day = parseISODate(s).getDay()
  return day === 0 ? 7 : day
}

export function startOfWeek(s: string): string {
  return addDays(s, 1 - isoWeekday(s))
}

export function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`
}

export function endOfMonth(s: string): string {
  const d = parseISODate(startOfMonth(s))
  d.setMonth(d.getMonth() + 1, 0)
  return toISODate(d)
}

export function addMonths(s: string, months: number): string {
  const d = parseISODate(startOfMonth(s))
  d.setMonth(d.getMonth() + months)
  return toISODate(d)
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)))
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}
