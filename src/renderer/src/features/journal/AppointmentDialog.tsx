import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { APPOINTMENT_LABELS } from '@shared/labels'
import { APPOINTMENT_KINDS, type Appointment, type AppointmentKind, type StudentSummary } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { tryCall } from '@/lib/api'

export type AppointmentDraft = Partial<Appointment> & { date: string; start_time: string; end_time: string }

export function AppointmentDialog({
  draft,
  students,
  onClose,
  onSaved
}: {
  draft: AppointmentDraft
  students: StudentSummary[]
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const isNew = draft.id === undefined
  const [form, setForm] = useState({
    date: draft.date,
    start_time: draft.start_time,
    end_time: draft.end_time,
    kind: (draft.kind ?? 'parents') as AppointmentKind,
    title: draft.title ?? '',
    location: draft.location ?? '',
    participants: draft.participants ?? '',
    notes: draft.notes ?? '',
    report: draft.report ?? '',
    student_ids: draft.student_ids ?? []
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const res = isNew ? await tryCall('appointments:create', form) : await tryCall('appointments:update', draft.id!, form)
    if (res) onSaved()
  }

  const remove = async (): Promise<void> => {
    if (!window.confirm('Supprimer ce rendez-vous ?')) return
    if ((await tryCall('appointments:delete', draft.id!)) !== undefined) onSaved()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Nouveau rendez-vous' : 'Rendez-vous'}
      className="max-w-2xl"
      footer={
        <>
          {!isNew && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={remove}>
              <Trash2 /> Supprimer
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="appt-form">Enregistrer</Button>
        </>
      }
    >
      <form id="appt-form" onSubmit={save} className="grid grid-cols-6 gap-4">
        <Field label="Type" className="col-span-2">
          <Select value={form.kind} onChange={(e) => set('kind', e.target.value as AppointmentKind)}>
            {APPOINTMENT_KINDS.map((k) => (
              <option key={k} value={k}>{APPOINTMENT_LABELS[k]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Objet" className="col-span-4">
          <Input required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Point sur les progrès en lecture" />
        </Field>
        <Field label="Date" className="col-span-2">
          <Input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Début" className="col-span-2">
          <Input type="time" step={300} required value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
        </Field>
        <Field label="Fin" className="col-span-2">
          <Input type="time" step={300} required value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
        </Field>
        <Field label="Lieu" className="col-span-3">
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="Participants" className="col-span-3">
          <Input value={form.participants} onChange={(e) => set('participants', e.target.value)} placeholder="Parents, psychologue EN, AESH…" />
        </Field>
        {students.length > 0 && (
          <Field label="Élève(s) concerné(s)" className="col-span-6">
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {students.map((s) => {
                const on = form.student_ids.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => set('student_ids', on ? form.student_ids.filter((x) => x !== s.id) : [...form.student_ids, s.id])}
                    className={on ? 'rounded-full border border-primary bg-primary px-2.5 py-0.5 text-xs text-primary-foreground' : 'rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent'}
                  >
                    {s.first_name} {s.last_name}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
        <Field label="Préparation / ordre du jour" className="col-span-6">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <Field label="Compte rendu" className="col-span-6">
          <Textarea value={form.report} onChange={(e) => set('report', e.target.value)} placeholder="Décisions, suites à donner…" />
        </Field>
      </form>
    </Dialog>
  )
}
