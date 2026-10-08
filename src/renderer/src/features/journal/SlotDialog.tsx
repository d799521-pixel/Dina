import { useEffect, useMemo, useState } from 'react'
import { BookMarked, ImagePlus, Trash2, X } from 'lucide-react'
import { STATUS_LABELS } from '@shared/labels'
import { SLOT_STATUSES, type JournalSlotView, type SlotImage, type SlotStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { call, tryCall } from '@/lib/api'
import { longDate } from '@/lib/format'
import { compressImage, pickImages, useImageUrls } from '@/lib/images'
import { notifyError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { JournalRefs } from './useJournalRefs'

export type SlotDraft = Partial<JournalSlotView> & { date: string; start_time: string; end_time: string }

const MATERNELLE = ['TPS', 'PS', 'MS', 'GS']

/** Photo pas encore enregistrée (créneau en cours de création). */
type PendingImage = { id: number; mime: string; data: Uint8Array }

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
    audience: draft.audience ?? '',
    activities: draft.activities ?? '',
    status: (draft.status ?? 'prevu') as SlotStatus,
    bilan: draft.bilan ?? ''
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => setForm((f) => ({ ...f, [k]: v }))
  const [images, setImages] = useState<(SlotImage | PendingImage)[]>([])
  const [busy, setBusy] = useState(false)
  const urls = useImageUrls(images)

  useEffect(() => {
    if (!isNew && draft.images_count) void tryCall('journal:images', draft.id!).then((i) => i && setImages(i))
  }, [isNew, draft.id, draft.images_count])

  const maternelleOnly = refs.levels.length > 0 && refs.levels.every((l) => MATERNELLE.includes(l))
  const groups = [...refs.levels, 'Groupe 1', 'Groupe 2', 'Groupe 3']

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

  const addImages = async (): Promise<void> => {
    const files = await pickImages()
    for (const file of files) {
      try {
        const img = await compressImage(file)
        if (isNew) setImages((list) => [...list, { id: -Date.now() - list.length, ...img }])
        else {
          const saved = await call('journal:add-image', draft.id!, img)
          setImages((list) => [...list, saved])
        }
      } catch (err) {
        notifyError(err)
      }
    }
  }

  const removeImage = async (id: number): Promise<void> => {
    if (id > 0 && (await tryCall('journal:delete-image', id)) === undefined) return
    setImages((list) => list.filter((i) => i.id !== id))
  }

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      if (isNew) {
        const { status, bilan, ...input } = form
        const slot = await call('journal:create', input)
        if (status !== 'prevu' || bilan) await call('journal:update', slot.id, { status, bilan })
        for (const img of images) await call('journal:add-image', slot.id, { mime: img.mime, data: img.data })
      } else {
        await call('journal:update', draft.id!, form)
      }
      onSaved()
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!window.confirm('Supprimer ce créneau, ses remarques et ses photos ?')) return
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
          <Button type="submit" form="slot-form" disabled={busy}>
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

        <div className="col-span-6">
          <span className="text-xs font-medium text-muted-foreground">Pour qui ?</span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {['', ...groups].map((g) => (
              <button
                key={g || 'tous'}
                type="button"
                onClick={() => set('audience', g)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  form.audience === g ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {g || 'Toute la classe'}
              </button>
            ))}
            <Input
              className="h-8 w-36"
              value={groups.includes(form.audience) ? '' : form.audience}
              onChange={(e) => set('audience', e.target.value)}
              placeholder="Autre groupe…"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Plusieurs créneaux à la même heure (ex. PS avec l’ATSEM, GS avec vous) s’affichent côte à côte.
          </p>
        </div>

        <Field label={maternelleOnly ? 'Domaine / moment' : 'Matière / domaine'} className={maternelleOnly ? 'col-span-6' : 'col-span-3'}>
          <Select value={form.subject_id ?? ''} onChange={(e) => set('subject_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>
            {refs.subjects.filter((s) => !s.archived || s.id === form.subject_id).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        {!maternelleOnly && (
          <Field label="Domaine du socle" className="col-span-3">
            <Select value={form.socle_domain ?? ''} onChange={(e) => set('socle_domain', e.target.value || null)}>
              <option value="">—</option>
              {refs.socle.map((d) => (
                <option key={d.code} value={d.code}>{d.code} · {d.label}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Intitulé" className="col-span-6">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Atelier dirigé avec PE, Lettres et compagnie…" />
        </Field>

        <Field label="Activités" className="col-span-6">
          <Textarea
            className="min-h-24"
            value={form.activities}
            onChange={(e) => set('activities', e.target.value)}
            placeholder={'Ex. ACCES Math : Dénombrer des quantités jusqu’à 5 – À la ferme, étapes 1 et 3\n- Puzzle\n- Tangram'}
          />
        </Field>

        <div className="col-span-6">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Photos (fiche, matériel, production…)</span>
            <Button variant="outline" size="sm" onClick={addImages}>
              <ImagePlus /> Ajouter des photos
            </Button>
          </div>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative">
                  <img src={urls.get(img.id)} alt="" className="h-24 rounded-md border object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-2 -right-2 rounded-full border bg-card p-0.5 shadow"
                    aria-label="Retirer la photo"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
