import type { DB } from './types'
import { migrations as defaultMigrations, type Migration } from './migrations'

/**
 * Applique les migrations manquantes. La version courante est stockée dans
 * `PRAGMA user_version` ; chaque migration s'exécute dans sa propre transaction
 * afin qu'un échec laisse la base dans l'état de la version précédente.
 */
export function migrate(db: DB, migrations: Migration[] = defaultMigrations): number {
  const current = db.pragma('user_version', { simple: true }) as number
  const latest = migrations.at(-1)?.version ?? 0
  if (current > latest) {
    throw new Error(
      `La base de données (v${current}) provient d'une version plus récente de l'application (v${latest}).`
    )
  }

  for (const migration of migrations) {
    if (migration.version <= current) continue
    db.transaction(() => {
      db.exec(migration.up)
      db.pragma(`user_version = ${migration.version}`)
    })()
  }
  return db.pragma('user_version', { simple: true }) as number
}
