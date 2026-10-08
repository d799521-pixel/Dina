import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, Layers } from 'lucide-react'
import type { Period, SequenceListItem, SocleDomain, Subject } from '@shared/types'
import { Segmented } from '@/components/ui/segmented'
import { call } from '@/lib/api'
import { notifyError } from '@/lib/toast'
import { ProgrammingView } from './ProgrammingView'
import { SequencesView, type SequenceSelection } from './SequencesView'

export interface PrepRefs {
  subjects: Subject[]
  periods: Period[]
  socle: SocleDomain[]
  sequences: SequenceListItem[]
}

export function PreparationsPage(): React.JSX.Element {
  const [tab, setTab] = useState<'programmation' | 'sequences'>('sequences')
  const [refs, setRefs] = useState<PrepRefs>()
  const [selected, setSelected] = useState<SequenceSelection>(null)

  const reload = useCallback(() => {
    Promise.all([call('ref:subjects'), call('periods:list'), call('ref:socle'), call('sequences:list')])
      .then(([subjects, periods, socle, sequences]) => setRefs({ subjects, periods, socle, sequences }))
      .catch(notifyError)
  }, [])
  useEffect(reload, [reload])

  const openSequence = (id: number): void => {
    setSelected(id)
    setTab('sequences')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b bg-card px-5 py-3">
        <h1 className="text-lg font-semibold">Préparations</h1>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sequences', label: <><Layers /> Séquences & séances</> },
            { value: 'programmation', label: <><CalendarRange /> Programmation annuelle</> }
          ]}
        />
      </header>
      <div className="min-h-0 flex-1">
        {refs &&
          (tab === 'programmation' ? (
            <ProgrammingView refs={refs} onRefsChanged={reload} onOpenSequence={openSequence} />
          ) : (
            <SequencesView refs={refs} onRefsChanged={reload} selected={selected} onSelect={setSelected} />
          ))}
      </div>
    </div>
  )
}

/** Matières proposées dans les préparations (sans récréation ni domaines archivés). */
export const activeSubjects = (subjects: Subject[]): Subject[] =>
  subjects.filter((s) => !s.archived && s.short_name !== 'Récré')
