import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Competency, Subject } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { call } from '@/lib/api'
import { notifyError } from '@/lib/toast'
import { cn } from '@/lib/utils'

let cache: Promise<Competency[]> | null = null
export const loadCompetencies = (): Promise<Competency[]> => (cache ??= call('ref:competencies'))

const AGE_LABEL: Record<string, string> = { PS: 'avant 4 ans', MS: 'à partir de 4 ans', GS: 'à partir de 5 ans' }

/**
 * Sélection d'objectifs dans le programme officiel de maternelle (2024-2026),
 * filtrés par domaine et par âge.
 */
export function CompetencyPicker({
  subjects,
  subjectId,
  selected,
  multiple,
  onClose,
  onConfirm
}: {
  subjects: Subject[]
  subjectId: number | null
  selected: number[]
  multiple: boolean
  onClose: () => void
  onConfirm: (items: Competency[]) => void
}): React.JSX.Element {
  const [all, setAll] = useState<Competency[]>([])
  const [domain, setDomain] = useState<number | ''>('')
  const [levels, setLevels] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<number[]>(selected)

  useEffect(() => {
    Promise.all([loadCompetencies(), call('db:status')])
      .then(([c, status]) => {
        setAll(c)
        const classLevels = (status.current_class?.levels ?? []).filter((l) => l in AGE_LABEL)
        setLevels(classLevels.length ? classLevels : ['PS', 'MS', 'GS'])
        if (subjectId && c.some((x) => x.subject_id === subjectId)) setDomain(subjectId)
      })
      .catch(notifyError)
  }, [subjectId])

  const domains = subjects.filter((s) => all.some((c) => c.subject_id === s.id))
  const q = query.trim().toLowerCase()
  const visible = all.filter(
    (c) =>
      (domain === '' || c.subject_id === domain) &&
      (!c.level || levels.includes(c.level)) &&
      (!q || `${c.label} ${c.skill} ${c.area}`.toLowerCase().includes(q))
  )

  // Regroupement : sous-domaine › compétence.
  const groups = useMemo(() => {
    const map = new Map<string, Competency[]>()
    for (const c of visible) {
      const key = `${c.area} › ${c.skill === c.area ? '' : c.skill}`.replace(/ › $/, '')
      map.set(key, [...(map.get(key) ?? []), c])
    }
    return [...map.entries()]
  }, [visible])

  const toggle = (c: Competency): void => {
    if (!multiple) {
      onConfirm([c])
      return
    }
    setChosen((ids) => (ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]))
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Programme de l’école maternelle"
      description="Objectifs d’apprentissage du programme 2024-2026, par âge."
      className="max-w-3xl"
      footer={
        multiple ? (
          <>
            <span className="mr-auto text-sm text-muted-foreground">{chosen.length} objectif(s) sélectionné(s)</span>
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => onConfirm(all.filter((c) => chosen.includes(c.id)))}>Valider</Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Select className="min-w-60 flex-1" value={domain} onChange={(e) => setDomain(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Tous les domaines</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <div className="flex gap-1">
            {['PS', 'MS', 'GS'].map((l) => (
              <button
                key={l}
                onClick={() => setLevels((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]))}
                className={cn('rounded-full border px-3 py-1 text-sm', levels.includes(l) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
                title={AGE_LABEL[l]}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher : syllabe, dénombrer, comptine…" />
        </div>
        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1">
          {groups.map(([title, items]) => (
            <section key={title}>
              <h3 className="sticky top-0 bg-card py-1 text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
              <ul className="flex flex-col gap-1">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => toggle(c)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent',
                        chosen.includes(c.id) && 'border-primary bg-accent'
                      )}
                    >
                      {multiple && <input type="checkbox" readOnly checked={chosen.includes(c.id)} className="mt-1" />}
                      <span className="flex-1">{c.label}</span>
                      {c.level && <span className="shrink-0 rounded bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-800">{c.level}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Aucun objectif ne correspond.</p>}
        </div>
      </div>
    </Dialog>
  )
}
