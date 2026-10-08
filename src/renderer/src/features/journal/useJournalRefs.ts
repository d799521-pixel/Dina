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
}

/** Données de référence utilisées par les vues et formulaires du journal. */
export function useJournalRefs(): { refs: JournalRefs | undefined; reloadRefs: () => void } {
  const [refs, setRefs] = useState<JournalRefs>()
  const load = useCallback(() => {
    Promise.all([call('ref:subjects'), call('ref:socle'), call('ref:lessons'), call('ref:students'), call('settings:get')])
      .then(([subjects, socle, lessons, students, settings]) => setRefs({ subjects, socle, lessons, students, settings }))
      .catch(notifyError)
  }, [])
  useEffect(load, [load])
  return { refs, reloadRefs: load }
}
