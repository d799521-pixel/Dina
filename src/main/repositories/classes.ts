import type { Period, SchoolClass } from '@shared/types'
import type { DB } from '../db/types'
import { getSetting, setSetting } from './settings'

interface ClassRow {
  id: number
  school_year_id: number
  name: string
  levels: string
}

const toClass = (r: ClassRow): SchoolClass => ({ ...r, levels: JSON.parse(r.levels) as string[] })

export function getCurrentClass(db: DB): SchoolClass | null {
  const id = getSetting<number>(db, 'current_class_id')
  if (!id) return null
  const row = db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRow | undefined
  return row ? toClass(row) : null
}

const MATERNELLE = ['TPS', 'PS', 'MS', 'GS']

export function createClassWithYear(db: DB, yearLabel: string, name: string, levels: string[]): SchoolClass {
  return db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO school_years (label) VALUES (?)').run(yearLabel)
    const year = db.prepare('SELECT id FROM school_years WHERE label = ?').get(yearLabel) as { id: number }
    const insertPeriod = db.prepare(
      'INSERT OR IGNORE INTO periods (school_year_id, number, label) VALUES (?, ?, ?)'
    )
    for (let n = 1; n <= 5; n++) insertPeriod.run(year.id, n, `Période ${n}`)

    const { lastInsertRowid } = db
      .prepare('INSERT INTO classes (school_year_id, name, levels) VALUES (?, ?, ?)')
      .run(year.id, name, JSON.stringify(levels))
    setSetting(db, 'current_class_id', Number(lastInsertRowid))

    // Active les domaines d'apprentissage de maternelle si besoin.
    if (levels.some((l) => MATERNELLE.includes(l))) {
      db.prepare('UPDATE subjects SET archived = 0 WHERE position >= 100').run()
    }
    return getCurrentClass(db)!
  })()
}

export function listPeriods(db: DB, schoolYearId: number): Period[] {
  return db
    .prepare('SELECT * FROM periods WHERE school_year_id = ? ORDER BY number')
    .all(schoolYearId) as Period[]
}
