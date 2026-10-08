import { useEffect, useState } from 'react'
import { BookMarked, Clock, FolderOpen, Layers, Plus, Save, Trash2 } from 'lucide-react'
import type { LessonHeader, SequenceInput, SequenceListItem } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { call, tryCall } from '@/lib/api'
import { alpha } from '@/lib/format'
import { SubjectIcon } from '@/lib/icons'
import { notify, notifyError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { LessonEditor } from './LessonEditor'
import { activeSubjects, type PrepRefs } from './PreparationsPage'

export type SequenceSelection = number | 'hors' | 'new' | null

export function SequencesView({
  refs,
  onRefsChanged,
  selected,
  onSelect
}: {
  refs: PrepRefs
  onRefsChanged: () => void
  selected: SequenceSelection
  onSelect: (s: SequenceSelection) => void
}): React.JSX.Element {
  const [periodFilter, setPeriodFilter] = useState(0)
  const [lesson, setLesson] = useState<number | 'new' | null>(null)
  const [lessonsKey, setLessonsKey] = useState(0)

  const sequences = refs.sequences.filter((s) => periodFilter === 0 || s.period_number === periodFilter)
  const current = typeof selected === 'number' ? refs.sequences.find((s) => s.id === selected) ?? null : null

  const select = (s: SequenceSelection): void => {
    setLesson(null)
    onSelect(s)
  }

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r bg-card">
        <div className="flex flex-col gap-2 border-b p-3">
          <Segmented
            value={periodFilter}
            onChange={setPeriodFilter}
            className="w-full justify-between"
            options={[{ value: 0, label: 'Toutes' }, ...refs.periods.map((p) => ({ value: p.number, label: `P${p.number}`, title: p.label }))]}
          />
          <Button onClick={() => select('new')}>
            <Plus /> Nouvelle séquence
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {sequences.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => select(s.id)}
                className={cn('flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted', selected === s.id && 'bg-accent')}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded" style={{ background: alpha(s.subject_color, 0.15), color: s.subject_color ?? undefined }}>
                  <SubjectIcon icon={s.subject_icon} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.subject_short ?? 'Sans matière'} · {s.period_number ? `P${s.period_number}` : 'sans période'} · {s.lessons_count}
                    {s.planned_sessions_count ? `/${s.planned_sessions_count}` : ''} séance(s)
                  </span>
                </span>
              </button>
            </li>
          ))}
          {sequences.length === 0 && <li className="p-3 text-sm text-muted-foreground">Aucune séquence pour cette période.</li>}
          <li className="mt-2 border-t pt-2">
            <button
              onClick={() => select('hors')}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted', selected === 'hors' && 'bg-accent')}
            >
              <FolderOpen className="size-4 text-muted-foreground" /> Séances hors séquence
            </button>
          </li>
        </ul>
      </aside>

      <section className="min-h-0 overflow-y-auto">
        {lesson !== null ? (
          <LessonEditor
            key={lesson}
            lessonId={lesson}
            sequenceId={typeof selected === 'number' ? selected : null}
            refs={refs}
            onBack={() => setLesson(null)}
            onChanged={(id) => {
              setLessonsKey((k) => k + 1)
              onRefsChanged()
              if (id === null) setLesson(null)
              else if (lesson === 'new') setLesson(id)
            }}
          />
        ) : selected === 'new' || current ? (
          <div className="mx-auto max-w-4xl p-6">
            <SequenceEditor
              key={current?.id ?? 'new'}
              sequence={current}
              refs={refs}
              defaultPeriodId={refs.periods.find((p) => p.number === periodFilter)?.id ?? null}
              onSaved={(s) => {
                onRefsChanged()
                onSelect(s.id)
              }}
              onDeleted={() => {
                onRefsChanged()
                onSelect(null)
              }}
            />
            {current && <LessonList sequenceId={current.id} reloadKey={lessonsKey} onOpen={setLesson} />}
          </div>
        ) : selected === 'hors' ? (
          <div className="mx-auto max-w-4xl p-6">
            <h2 className="text-xl font-semibold">Séances hors séquence</h2>
            <p className="mt-1 text-sm text-muted-foreground">Séances ponctuelles : rituels, remplacements, projets…</p>
            <LessonList sequenceId={null} reloadKey={lessonsKey} onOpen={setLesson} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Layers className="size-10" />
            Choisissez une séquence à gauche ou créez-en une.
            <br />
            Les séances créées ici se lient ensuite en un clic aux créneaux du cahier journal.
          </div>
        )}
      </section>
    </div>
  )
}

const EMPTY_SEQUENCE: SequenceInput = {
  subject_id: null,
  period_id: null,
  title: '',
  levels: [],
  socle_domain: null,
  general_objectives: '',
  prerequisites: '',
  planned_sessions_count: null,
  success_criteria: '',
  final_assessment: '',
  notes: ''
}

function toInput(s: SequenceListItem): SequenceInput {
  const { subject_id, period_id, title, levels, socle_domain, general_objectives, prerequisites, planned_sessions_count, success_criteria, final_assessment, notes } = s
  return { subject_id, period_id, title, levels, socle_domain, general_objectives, prerequisites, planned_sessions_count, success_criteria, final_assessment, notes }
}

function SequenceEditor({
  sequence,
  refs,
  defaultPeriodId,
  onSaved,
  onDeleted
}: {
  sequence: SequenceListItem | null
  refs: PrepRefs
  defaultPeriodId: number | null
  onSaved: (s: SequenceListItem) => void
  onDeleted: () => void
}): React.JSX.Element {
  const initial = sequence ? toInput(sequence) : { ...EMPTY_SEQUENCE, period_id: defaultPeriodId }
  const [form, setForm] = useState<SequenceInput>(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = <K extends keyof SequenceInput>(k: K, v: SequenceInput[K]): void => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e?: React.FormEvent): Promise<void> => {
    e?.preventDefault()
    try {
      const saved = sequence ? await call('sequences:update', sequence.id, form) : await call('sequences:create', form)
      notify('Séquence enregistrée.')
      onSaved(saved)
    } catch (err) {
      notifyError(err)
    }
  }

  const remove = async (): Promise<void> => {
    if (!sequence || !window.confirm('Supprimer cette séquence ? Ses séances sont conservées (hors séquence).')) return
    if ((await tryCall('sequences:delete', sequence.id)) !== undefined) onDeleted()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-xl font-semibold">{sequence ? 'Fiche séquence' : 'Nouvelle séquence'}</h2>
        {sequence && (
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 /> Supprimer
          </Button>
        )}
        <Button type="submit" disabled={!dirty || !form.title.trim()}>
          <Save /> Enregistrer
        </Button>
      </div>
      <div className="grid grid-cols-6 gap-4 rounded-xl border bg-card p-5">
        <Field label="Titre de la séquence" className="col-span-6">
          <Input autoFocus={!sequence} required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Le conte merveilleux" />
        </Field>
        <Field label="Matière / domaine" className="col-span-2">
          <Select value={form.subject_id ?? ''} onChange={(e) => set('subject_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {activeSubjects(refs.subjects).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Période" className="col-span-1">
          <Select value={form.period_id ?? ''} onChange={(e) => set('period_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {refs.periods.map((p) => (
              <option key={p.id} value={p.id}>P{p.number}</option>
            ))}
          </Select>
        </Field>
        <Field label="Séances prévues" className="col-span-1">
          <Input
            type="number"
            min={1}
            value={form.planned_sessions_count ?? ''}
            onChange={(e) => set('planned_sessions_count', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label="Domaine du socle" className="col-span-2">
          <Select value={form.socle_domain ?? ''} onChange={(e) => set('socle_domain', e.target.value || null)}>
            <option value="">—</option>
            {refs.socle.map((d) => (
              <option key={d.code} value={d.code} title={d.label}>{d.code} · {d.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Objectifs généraux / compétences visées" className="col-span-3">
          <Textarea value={form.general_objectives} onChange={(e) => set('general_objectives', e.target.value)} />
        </Field>
        <Field label="Prérequis" className="col-span-3">
          <Textarea value={form.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} />
        </Field>
        <Field label="Critères de réussite" className="col-span-3">
          <Textarea value={form.success_criteria} onChange={(e) => set('success_criteria', e.target.value)} />
        </Field>
        <Field label="Évaluation finale" className="col-span-3">
          <Textarea value={form.final_assessment} onChange={(e) => set('final_assessment', e.target.value)} />
        </Field>
        <Field label="Notes, ressources, prolongements" className="col-span-6">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-14" />
        </Field>
      </div>
    </form>
  )
}

function LessonList({ sequenceId, reloadKey, onOpen }: { sequenceId: number | null; reloadKey: number; onOpen: (id: number | 'new') => void }): React.JSX.Element {
  const [lessons, setLessons] = useState<LessonHeader[]>([])
  useEffect(() => {
    void tryCall('lessons:of-sequence', sequenceId).then((l) => l && setLessons(l))
  }, [sequenceId, reloadKey])

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase">Séances</h3>
        <Button variant="outline" size="sm" onClick={() => onOpen('new')}>
          <Plus /> Nouvelle séance
        </Button>
      </div>
      <ol className="flex flex-col gap-2">
        {lessons.map((l) => (
          <li key={l.id}>
            <button onClick={() => onOpen(l.id)} className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary/50">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                {l.number_in_sequence ?? <BookMarked className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.title}</span>
                {l.specific_objective && <span className="block truncate text-sm text-muted-foreground">{l.specific_objective}</span>}
              </span>
              {l.duration_min && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" /> {l.duration_min} min
                </span>
              )}
            </button>
          </li>
        ))}
        {lessons.length === 0 && <li className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucune séance pour l’instant.</li>}
      </ol>
    </div>
  )
}
