import type { AppSettings } from '@shared/types'
import type { DB } from '../db/types'
import { assertTime, ValidationError } from '../validation'

const DEFAULTS: AppSettings = {
  // Semaine de quatre jours par défaut : lundi, mardi, jeudi, vendredi.
  school_days: [1, 2, 4, 5],
  day_start: '08:30',
  day_end: '16:30'
}

export function getSetting<T>(db: DB, key: string): T | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? (JSON.parse(row.value) as T) : undefined
}

export function setSetting(db: DB, key: string, value: unknown): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, JSON.stringify(value))
}

export function getAppSettings(db: DB): AppSettings {
  return { ...DEFAULTS, ...(getSetting<Partial<AppSettings>>(db, 'app') ?? {}) }
}

export function updateAppSettings(db: DB, patch: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettings(db), ...patch }
  if (
    !Array.isArray(next.school_days) ||
    next.school_days.length === 0 ||
    next.school_days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
  ) {
    throw new ValidationError('Jours de classe invalides')
  }
  next.school_days = [...new Set(next.school_days)].sort()
  assertTime(next.day_start, 'début de journée')
  assertTime(next.day_end, 'fin de journée')
  if (next.day_start >= next.day_end) throw new ValidationError('Horaires de journée invalides')
  setSetting(db, 'app', next)
  return next
}
