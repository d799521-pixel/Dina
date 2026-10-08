import * as m001 from './001_initial'
import * as m002 from './002_referentials'

export interface Migration {
  version: number
  name: string
  up: string
}

/**
 * Liste ordonnée des migrations. Ne jamais modifier une migration publiée :
 * ajouter un nouveau fichier `00N_xxx.ts` et l'enregistrer ici.
 */
export const migrations: Migration[] = [
  { version: 1, name: 'initial', up: m001.up },
  { version: 2, name: 'referentials', up: m002.up }
]
