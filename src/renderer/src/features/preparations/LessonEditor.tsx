import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, CalendarCheck, Copy, FileDown, ListChecks, Plus, Save, Trash2, X } from 'lucide-react'
import { WORK_MODE_LABELS } from '@shared/labels'
import { WORK_MODES, type Lesson, type LessonInput, type LessonStep, type WorkMode } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { call, tryCall } from '@/lib/api'
import { fmt } from '@/lib/format'
import { lessonDocument } from '@/lib/printDocs'
import { notify, notifyError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CompetencyPicker } from './CompetencyPicker'
import { activeSubjects, type PrepRefs } from './PreparationsPage'

const step = (title: string, work_mode: WorkMode, duration_min: number | null = null): LessonStep => ({
  title,
  duration_min,
  work_mode,
  teacher_role: '',
  student_activity: '',
  materials: ''
})

/** Trame proposée pour une nouvelle fiche. */
const TEMPLATE_STEPS = [
  step('Rappel / mise en situation', 'collectif', 5),
  step('Recherche', 'individuel', 15),
  step('Mise en commun', 'collectif', 10),
  step('Institutionnalisation', 'collectif', 5),
  step('Entraînement', 'individuel', 10)
]

const MODE_STYLE: Record<WorkMode, string> = {
  individuel: 'bg-sky-100 text-sky-800',
  binome: 'bg-violet-100 text-violet-800',
  groupe: 'bg-amber-100 text-amber-800',
  collectif: 'bg-emerald-100 text-emerald-800'
}

function toInput(l: Lesson): LessonInput {
  const { id: _i, class_id: _c, created_at: _a, updated_at: _u, scheduled_dates: _d, ...input } = l
  return input
}

export function LessonEditor({
  lessonId,
  sequenceId,
  refs,
  onBack,
  onChanged
}: {
  lessonId: number | 'new'
  sequenceId: number | null
  refs: PrepRefs
  onBack: () => void
  /** id de la séance enregistrée, ou null si elle a été supprimée. */
  onChanged: (id: number | null) => void
}): React.JSX.Element | null {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [form, setForm] = useState<LessonInput | null>(null)
  const [saved, setSaved] = useState('')
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (lessonId === 'new') {
      const seq = refs.sequences.find((s) => s.id === sequenceId)
      const draft: LessonInput = {
        sequence_id: sequenceId,
        subject_id: seq?.subject_id ?? null,
        number_in_sequence: null,
        title: '',
        specific_objective: '',
        duration_min: 45,
        materials: '',
        success_criteria: '',
        differentiation: '',
        institutionalization: '',
        assessment: '',
        notes: '',
        steps: TEMPLATE_STEPS
      }
      setForm(draft)
      setSaved(JSON.stringify(draft))
    } else {
      void tryCall('lessons:get', lessonId).then((l) => {
        if (!l) return
        setLesson(l)
        setForm(toInput(l))
        setSaved(JSON.stringify(toInput(l)))
      })
    }
    // Chargé une seule fois par séance : un rechargement des listes ne doit pas écraser la saisie.
  }, [lessonId, sequenceId])

  if (!form) return null
  const dirty = JSON.stringify(form) !== saved
  const set = <K extends keyof LessonInput>(k: K, v: LessonInput[K]): void => setForm((f) => f && { ...f, [k]: v })
  const setStep = (i: number, patch: Partial<LessonStep>): void =>
    set('steps', form.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const moveStep = (i: number, d: -1 | 1): void => {
    const steps = [...form.steps]
    ;[steps[i], steps[i + d]] = [steps[i + d], steps[i]]
    set('steps', steps)
  }
  const total = form.steps.reduce((sum, s) => sum + (s.duration_min ?? 0), 0)
  const sequence = refs.sequences.find((s) => s.id === form.sequence_id) ?? null

  const save = async (): Promise<Lesson | undefined> => {
    try {
      const l = lessonId === 'new' ? await call('lessons:create', form) : await call('lessons:update', lessonId, form)
      setLesson(l)
      setForm(toInput(l))
      setSaved(JSON.stringify(toInput(l)))
      notify('Fiche de préparation enregistrée.')
      onChanged(l.id)
      return l
    } catch (err) {
      notifyError(err)
      return undefined
    }
  }

  const back = (): void => {
    if (!dirty || window.confirm('Quitter sans enregistrer les modifications ?')) onBack()
  }

  const exportPdf = async (): Promise<void> => {
    const l = dirty || !lesson ? await save() : lesson
    if (!l) return
    const subject = refs.subjects.find((s) => s.id === l.subject_id)
    const path = await tryCall('pdf:export', lessonDocument(l, sequence, subject), `${l.title}.pdf`)
    if (path) notify(`PDF enregistré : ${path}`)
  }

  const duplicate = async (): Promise<void> => {
    if (!lesson) return
    const copy = await tryCall('lessons:duplicate', lesson.id)
    if (copy) {
      notify('Séance dupliquée.')
      onChanged(copy.id)
    }
  }

  const remove = async (): Promise<void> => {
    if (!lesson || !window.confirm('Supprimer cette fiche ? Les créneaux du cahier journal sont conservés.')) return
    if ((await tryCall('lessons:delete', lesson.id)) !== undefined) onChanged(null)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Retour">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">{sequence ? `Séquence « ${sequence.title} »` : 'Séance hors séquence'}</div>
          <h2 className="truncate text-xl font-semibold">{form.title || 'Nouvelle séance'}</h2>
        </div>
        {lesson && (
          <>
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 /> Supprimer
            </Button>
            <Button variant="outline" onClick={duplicate}>
              <Copy /> Dupliquer
            </Button>
          </>
        )}
        <Button variant="outline" onClick={exportPdf} disabled={!form.title.trim()}>
          <FileDown /> PDF
        </Button>
        <Button onClick={save} disabled={!dirty || !form.title.trim()}>
          <Save /> Enregistrer
        </Button>
      </div>

      {lesson && lesson.scheduled_dates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarCheck className="size-4 text-emerald-600" /> Programmée au cahier journal :
          {lesson.scheduled_dates.map((d) => (
            <Badge key={d} className="border-emerald-300 bg-emerald-50 text-emerald-800">{fmt(d, 'EEE d MMM')}</Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-6 gap-4 rounded-xl border bg-card p-5">
        <Field label="Titre de la séance" className="col-span-4">
          <Input autoFocus={lessonId === 'new'} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Découvrir la retenue" />
        </Field>
        <Field label="N° dans la séquence" className="col-span-1">
          <Input type="number" min={1} value={form.number_in_sequence ?? ''} onChange={(e) => set('number_in_sequence', e.target.value ? Number(e.target.value) : null)} placeholder="auto" />
        </Field>
        <Field label="Durée (min)" className="col-span-1">
          <Input type="number" min={5} step={5} value={form.duration_min ?? ''} onChange={(e) => set('duration_min', e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <Field label="Séquence" className="col-span-3">
          <Select value={form.sequence_id ?? ''} onChange={(e) => set('sequence_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Hors séquence</option>
            {refs.sequences.map((s) => (
              <option key={s.id} value={s.id}>{s.period_number ? `P${s.period_number} · ` : ''}{s.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Matière" className="col-span-3">
          <Select value={(sequence?.subject_id ?? form.subject_id) ?? ''} disabled={Boolean(sequence)} onChange={(e) => set('subject_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {activeSubjects(refs.subjects).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <div className="col-span-6 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Objectif spécifique</span>
            <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
              <ListChecks /> Depuis le programme
            </Button>
          </div>
          <Textarea className="min-h-14" value={form.specific_objective} onChange={(e) => set('specific_objective', e.target.value)} placeholder="À la fin de la séance, l’élève sera capable de…" />
        </div>
        {picking && (
          <CompetencyPicker
            subjects={refs.subjects}
            subjectId={sequence?.subject_id ?? form.subject_id}
            selected={[]}
            multiple={false}
            onClose={() => setPicking(false)}
            onConfirm={([c]) => {
              set('specific_objective', form.specific_objective.trim() ? `${form.specific_objective.trim()}\n${c.label}` : c.label)
              setPicking(false)
            }}
          />
        )}
        <Field label="Matériel" className="col-span-3">
          <Textarea className="min-h-14" value={form.materials} onChange={(e) => set('materials', e.target.value)} />
        </Field>
        <Field label="Critères de réussite" className="col-span-3">
          <Textarea className="min-h-14" value={form.success_criteria} onChange={(e) => set('success_criteria', e.target.value)} />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">Déroulement</h3>
          <span className={cn('text-sm', form.duration_min && total > form.duration_min ? 'font-medium text-amber-700' : 'text-muted-foreground')}>
            Total : {total} min{form.duration_min ? ` / ${form.duration_min} min prévues` : ''}
          </span>
        </div>
        <ol className="flex flex-col gap-2">
          {form.steps.map((s, i) => (
            <li key={i} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">{i + 1}</span>
                <Input className="flex-1 font-medium" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} placeholder="Phase" />
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} step={5} className="w-20" value={s.duration_min ?? ''} onChange={(e) => setStep(i, { duration_min: e.target.value ? Number(e.target.value) : null })} aria-label="Durée en minutes" />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
                <Select className={cn('w-32 border-0 font-medium', MODE_STYLE[s.work_mode])} value={s.work_mode} onChange={(e) => setStep(i, { work_mode: e.target.value as WorkMode })} aria-label="Modalité">
                  {WORK_MODES.map((m) => (
                    <option key={m} value={m}>{WORK_MODE_LABELS[m]}</option>
                  ))}
                </Select>
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Monter"><ArrowUp /></Button>
                <Button variant="ghost" size="icon" disabled={i === form.steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Descendre"><ArrowDown /></Button>
                <Button variant="ghost" size="icon" onClick={() => set('steps', form.steps.filter((_, j) => j !== i))} aria-label="Supprimer l’étape"><X /></Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 pl-9">
                <Textarea className="min-h-16 text-sm" value={s.teacher_role} onChange={(e) => setStep(i, { teacher_role: e.target.value })} placeholder="Rôle de l’enseignant·e (consigne, questions…)" />
                <Textarea className="min-h-16 text-sm" value={s.student_activity} onChange={(e) => setStep(i, { student_activity: e.target.value })} placeholder="Activité des élèves" />
                <Textarea className="min-h-16 text-sm" value={s.materials} onChange={(e) => setStep(i, { materials: e.target.value })} placeholder="Matériel de l’étape" />
              </div>
            </li>
          ))}
        </ol>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => set('steps', [...form.steps, step('', 'collectif')])}>
          <Plus /> Ajouter une étape
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5">
        <Field label="Différenciation (aides, étayage, défis)">
          <Textarea value={form.differentiation} onChange={(e) => set('differentiation', e.target.value)} />
        </Field>
        <Field label="Institutionnalisation / trace écrite">
          <Textarea value={form.institutionalization} onChange={(e) => set('institutionalization', e.target.value)} />
        </Field>
        <Field label="Évaluation">
          <Textarea value={form.assessment} onChange={(e) => set('assessment', e.target.value)} />
        </Field>
        <Field label="Remarques, bilan, pistes">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </div>
  )
}
