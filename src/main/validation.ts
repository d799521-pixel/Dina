// Validation minimale des données reçues par IPC : l'interface est de confiance
// relative, mais la base ne doit jamais recevoir de valeurs incohérentes.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function assertDate(value: unknown, field = 'date'): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) throw new ValidationError(`${field} invalide`)
  return value
}

export function assertTime(value: unknown, field = 'heure'): string {
  if (typeof value !== 'string' || !TIME_RE.test(value)) throw new ValidationError(`${field} invalide`)
  return value
}

export function assertTimeRange(start: unknown, end: unknown): [string, string] {
  const s = assertTime(start, 'heure de début')
  const e = assertTime(end, 'heure de fin')
  if (s >= e) throw new ValidationError("L'heure de fin doit être après l'heure de début")
  return [s, e]
}

export function assertId(value: unknown, field = 'id'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} invalide`)
  }
  return value
}

export function optionalId(value: unknown, field = 'id'): number | null {
  return value === null || value === undefined ? null : assertId(value, field)
}

export function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${field} invalide`)
  }
  return value as T
}

export function text(value: unknown, field: string, max = 20_000): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new ValidationError(`${field} invalide`)
  if (value.length > max) throw new ValidationError(`${field} trop long`)
  return value
}
