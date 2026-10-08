import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from 'lucide-react'
import type { Period, ProgrammingItem } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/input'
import { call, tryCall } from '@/lib/api'
import { alpha } from '@/lib/format'
import { SubjectIcon } from '@/lib/icons'
import { notifyError } from '@/lib/toast'
import { activeSubjects, type PrepRefs } from './PreparationsPage'

const short = (d: string | null): string => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '')

/**
 * Programmation annuelle : une ligne par matière, une colonne par période.
 * L'ordre dans chaque case constitue la progression.
 */
export function ProgrammingView({
  refs,
  onRefsChanged,
  onOpenSequence
}: {
  refs: PrepRefs
  onRefsChanged: () => void
  onOpenSequence: (id: number) => void
}): React.JSX.Element {
  const [items, setItems] = useState<ProgrammingItem[]>([])
  const [adding, setAdding] = useState<string | null>(null) // « subjectId:periodId »
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState<ProgrammingItem | null>(null)
  const [period, setPeriod] = useState<Period | null>(null)

  const load = (): void => void tryCall('programming:list').then((i) => i && setItems(i))
  useEffect(load, [])

  // Évite un double ajout (validation par Entrée puis perte de focus).
  const adding$ = useRef(false)
  const add = async (subjectId: number, periodId: number): Promise<void> => {
    if (adding$.current) return
    adding$.current = true
    if (newTitle.trim()) {
      await tryCall('programming:create', { subject_id: subjectId, period_id: periodId, sequence_id: null, title: newTitle, description: '' })
      load()
    }
    setNewTitle('')
    setAdding(null)
    adding$.current = false
  }

  const subjects = activeSubjects(refs.subjects)

  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-44" />
            {refs.periods.map((p) => (
              <th key={p.id} className="rounded-md bg-card p-0 font-normal">
                <button onClick={() => setPeriod(p)} className="w-full rounded-md px-2 py-2 hover:bg-accent" title="Modifier les dates de la période">
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.start_date ? `${short(p.start_date)} → ${short(p.end_date)}` : 'dates à renseigner'}
                  </div>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id}>
              <th className="rounded-md p-2 text-left align-top text-sm font-medium" style={{ background: alpha(s.color, 0.1), color: s.color }}>
                <span className="flex items-center gap-2">
                  <SubjectIcon icon={s.icon} className="size-4 shrink-0" /> {s.name}
                </span>
              </th>
              {refs.periods.map((p) => {
                const key = `${s.id}:${p.id}`
                const cellItems = items.filter((i) => i.subject_id === s.id && i.period_id === p.id)
                const linked = new Set(cellItems.map((i) => i.sequence_id))
                const looseSequences = refs.sequences.filter((q) => q.subject_id === s.id && q.period_id === p.id && !linked.has(q.id))
                return (
                  <td key={p.id} className="group rounded-md border bg-card p-1.5 align-top">
                    <ol className="flex flex-col gap-1">
                      {cellItems.map((i, n) => (
                        <li key={i.id}>
                          <button
                            onClick={() => setEditing(i)}
                            className="flex w-full items-start gap-1 rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                            style={{ borderLeft: `3px solid ${s.color}` }}
                          >
                            <span className="text-muted-foreground">{n + 1}.</span>
                            <span className="flex-1">{i.title}</span>
                            {i.sequence_id && <Layers className="mt-0.5 size-3 shrink-0 text-primary" aria-label="Séquence créée" />}
                          </button>
                        </li>
                      ))}
                      {looseSequences.map((q) => (
                        <li key={`q${q.id}`}>
                          <button
                            onClick={() => onOpenSequence(q.id)}
                            className="flex w-full items-center gap-1 rounded border border-dashed px-1.5 py-1 text-left text-xs text-primary hover:bg-accent"
                          >
                            <Layers className="size-3 shrink-0" /> {q.title}
                          </button>
                        </li>
                      ))}
                    </ol>
                    {adding === key ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          void add(s.id, p.id)
                        }}
                      >
                        <Input
                          autoFocus
                          className="mt-1 h-7 text-xs"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onBlur={() => add(s.id, p.id)}
                          onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
                          placeholder="Notion, compétence…"
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => setAdding(key)}
                        className="mt-1 flex w-full items-center justify-center rounded py-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted"
                        aria-label="Ajouter"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <ItemDialog
          item={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            load()
            onRefsChanged()
          }}
          onOpenSequence={onOpenSequence}
        />
      )}
      {period && (
        <PeriodDialog
          period={period}
          onClose={() => setPeriod(null)}
          onSaved={() => {
            setPeriod(null)
            onRefsChanged()
          }}
        />
      )}
    </div>
  )
}

function ItemDialog({
  item,
  onClose,
  onChanged,
  onOpenSequence
}: {
  item: ProgrammingItem
  onClose: () => void
  onChanged: () => void
  onOpenSequence: (id: number) => void
}): React.JSX.Element {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const input = { subject_id: item.subject_id, period_id: item.period_id, sequence_id: item.sequence_id, title, description }

  const save = async (): Promise<boolean> => Boolean(await tryCall('programming:update', item.id, input))

  const move = async (dir: -1 | 1): Promise<void> => {
    await tryCall('programming:move', item.id, dir)
    onChanged()
  }

  const toSequence = async (): Promise<void> => {
    try {
      await call('programming:update', item.id, input)
      const seq = await call('programming:to-sequence', item.id)
      onChanged()
      onOpenSequence(seq.id)
    } catch (err) {
      notifyError(err)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Élément de programmation"
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto text-destructive"
            onClick={async () => {
              await tryCall('programming:delete', item.id)
              onChanged()
              onClose()
            }}
          >
            <Trash2 /> Supprimer
          </Button>
          <Button variant="outline" onClick={toSequence}>
            <Layers /> {item.sequence_id ? 'Ouvrir la séquence' : 'Créer la séquence'}
          </Button>
          <Button
            onClick={async () => {
              if (await save()) {
                onChanged()
                onClose()
              }
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Intitulé">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Détails (compétences, attendus…)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Progression :
          <Button variant="outline" size="sm" onClick={() => move(-1)}>
            <ArrowUp /> Avant
          </Button>
          <Button variant="outline" size="sm" onClick={() => move(1)}>
            <ArrowDown /> Après
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function PeriodDialog({ period, onClose, onSaved }: { period: Period; onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const [form, setForm] = useState({ label: period.label, start_date: period.start_date, end_date: period.end_date })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Période ${period.number}`}
      description="Dates entre deux vacances scolaires (selon votre zone)."
      footer={
        <Button
          onClick={async () => {
            if (await tryCall('periods:update', period.id, form)) onSaved()
          }}
        >
          Enregistrer
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Libellé" className="col-span-2">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <Field label="Début">
          <Input type="date" value={form.start_date ?? ''} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} />
        </Field>
        <Field label="Fin">
          <Input type="date" value={form.end_date ?? ''} onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} />
        </Field>
      </div>
    </Dialog>
  )
}
