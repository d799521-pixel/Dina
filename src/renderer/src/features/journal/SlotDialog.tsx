import { useMemo, useState } from 'react'
import { BookMarked, Trash2 } from 'lucide-react'
import { STATUS_LABELS } from '@shared/labels'
import { SLOT_STATUSES, type JournalSlotView, type SlotStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { tryCall } from '@/lib/api'
import { longDate } from '@/lib/format'
import type { JournalRefs } from './useJournalRefs'

export type SlotDraft = Partial<JournalSlotView> & { date: string; start_time: string; end_time: string }

export function SlotDialog({
  draft,
  refs,
  onClose,
  onSaved
}: {
  draft: SlotDraft
  refs: JournalRefs
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const isNew = draft.id === undefined
  const [form, setForm] = useState({
    date: draft.date,
    start_time: draft.start_time,
    end_time: draft.end_time,
    subject_id: draft.subject_id ?? null,
    title: draft.title ?? '',
    socle_domain: draft.socle_domain ?? null,
    lesson_id: draft.lesson_id ?? null,
    status: (draft.status ?? 'prevu') as SlotStatus,
    bilan: draft.bilan ?? ''
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => setForm((f) => ({ ...f, [k]: v }))

  // Séances proposées : celles de la matière choisie en premier, groupées par séquence.
  const lessonGroups = useMemo(() => {
    const groups = new Map<string, typeof refs.lessons>()
    const sorted = [...refs.lessons].sort((a, b) => Number(b.subject_id === form.subject_id) - Number(a.subject_id === form.subject_id))
    for (const l of sorted) {
      const key = l.sequence_title ?? 'Séances hors séquence'
      groups.set(key, [...(groups.get(key) ?? []), l])
    }
    return [...groups.entries()]
  }, [refs.lessons, form.subject_id])

  const lesson = refs.lessons.find((l) => l.id === form.lesson_id)

  const pickLesson = (id: number | null): void => {
    const l = refs.lessons.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      lesson_id: id,
      subject_id: f.subject_id ?? l?.subject_id ?? null,
      title: f.title || l?.title || ''
    }))
  }

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const { status, bilan, ...input } = form
    const ok = isNew
      ? await tryCall('journal:create', input).then(async (s) => s && (status !== 'prevu' || bilan ? tryCall('journal:update', s.id, { status, bilan }) : s))
      : await tryCall('journal:update', draft.id!, form)
    if (ok) onSaved()
  }

  const remove = async (): Promise<void> => {
    if (!window.confirm('Supprimer ce créneau et ses remarques ?')) return
    if ((await tryCall('journal:delete', draft.id!)) !== undefined) onSaved()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Nouveau créneau' : 'Modifier le créneau'}
      description={longDate(form.date)}
      className="max-w-2xl"
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={remove}>
              <Trash2 /> Supprimer
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="slot-form">
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="slot-form" onSubmit={save} className="grid grid-cols-6 gap-4">
        <Field label="Date" className="col-span-2">
          <Input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Début" className="col-span-2">
          <Input type="time" step={300} required value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
        </Field>
        <Field label="Fin" className="col-span-2">
          <Input type="time" step={300} required value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
        </Field>

        <Field label="Matière / domaine" className="col-span-3">
          <Select value={form.subject_id ?? ''} onChange={(e) => set('subject_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {refs.subjects.filter((s) => !s.archived || s.id === form.subject_id).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Domaine du socle" className="col-span-3">
          <Select value={form.socle_domain ?? ''} onChange={(e) => set('socle_domain', e.target.value || null)}>
            <option value="">—</option>
            {refs.socle.map((d) => (
              <option key={d.code} value={d.code}>{d.code} · {d.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Intitulé" className="col-span-6">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Lecture compréhension — album" />
        </Field>

        <div className="col-span-6 rounded-lg border border-dashed p-3">
          <Field label="Fiche de préparation liée">
            <Select value={form.lesson_id ?? ''} onChange={(e) => pickLesson(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Aucune séance liée</option>
              {lessonGroups.map(([group, lessons]) => (
                <optgroup key={group} label={group}>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.number_in_sequence ? `S${l.number_in_sequence} · ` : ''}{l.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          {lesson && (
            <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
              <BookMarked className="mt-0.5 size-4 shrink-0 text-primary" />
              {lesson.specific_objective || 'Pas d’objectif renseigné.'}
              {lesson.duration_min ? ` (${lesson.duration_min} min)` : ''}
            </p>
          )}
          {refs.lessons.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Les fiches créées dans « Préparations » apparaîtront ici.</p>
          )}
        </div>

        {!isNew && (
          <>
            <Field label="Statut" className="col-span-2">
              <Select value={form.status} onChange={(e) => set('status', e.target.value as SlotStatus)}>
                {SLOT_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bilan de séance" className="col-span-6">
              <Textarea value={form.bilan} onChange={(e) => set('bilan', e.target.value)} />
            </Field>
          </>
        )}
      </form>
    </Dialog>
  )
}
