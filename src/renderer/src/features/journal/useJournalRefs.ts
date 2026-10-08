import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, LessonSummary, SocleDomain, StudentSummary, Subject } from '@shared/types'
import { call } from '@/lib/api'
import { notifyError } from '@/lib/toast'

export interface JournalRefs {
  subjects: Subject[]
  socle: SocleDomain[]
  lessons: LessonSummary[]
  students: StudentSummary[]
  settings: AppSettings
  /** Niveaux de la classe (PS, GS…), proposés comme groupes des créneaux. */
  levels: string[]
}

/** Données de référence utilisées par les vues et formulaires du journal. */
export function useJournalRefs(): { refs: JournalRefs | undefined; reloadRefs: () => void } {
  const [refs, setRefs] = useState<JournalRefs>()
  const load = useCallback(() => {
    Promise.all([call('ref:subjects'), call('ref:socle'), call('ref:lessons'), call('ref:students'), call('settings:get'), call('db:status')])
      .then(([subjects, socle, lessons, students, settings, status]) =>
        setRefs({ subjects, socle, lessons, students, settings, levels: status.current_class?.levels ?? [] })
      )
      .catch(notifyError)
  }, [])
  useEffect(load, [load])
  return { refs, reloadRefs: load }
}
