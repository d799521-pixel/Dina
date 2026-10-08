import type { DinaTemplate } from '@shared/types'
import { call } from './api'

/**
 * Applique un modèle importé : réglages de la semaine, emploi du temps type et
 * éléments de programmation (ajoutés à la suite de l'existant).
 */
export async function applyTemplate(raw: unknown, replaceTimetable: boolean): Promise<string> {
  const t = raw as DinaTemplate
  if (!t || t.format !== 'dina-modele' || t.version !== 1) throw new Error('Ce fichier n’est pas un modèle Dina.')
  const done: string[] = []

  if (t.settings) {
    await call('settings:update', t.settings)
    done.push('réglages de la semaine')
  }
  if (t.timetable?.length && replaceTimetable) {
    const n = await call('timetable:replace', t.timetable)
    done.push(`emploi du temps type (${n} créneaux)`)
  }
  if (t.programming?.length) {
    const [subjects, periods] = await Promise.all([call('ref:subjects'), call('periods:list')])
    const find = (name: string): number | null => {
      const n = name.toLowerCase()
      return subjects.find((s) => s.name.toLowerCase() === n || s.short_name.toLowerCase() === n)?.id ?? null
    }
    for (const item of t.programming) {
      await call('programming:create', {
        subject_id: find(item.subject),
        period_id: periods.find((p) => p.number === item.period)?.id ?? null,
        sequence_id: null,
        title: item.title,
        description: item.description ?? ''
      })
    }
    done.push(`programmation (${t.programming.length} éléments)`)
  }
  if (done.length === 0) return 'Le modèle ne contenait rien à importer.'
  return `Importé : ${done.join(', ')}.`
}
