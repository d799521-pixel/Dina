import { useEffect, useState } from 'react'
import { BookMarked, CalendarClock, Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { timeToMinutes } from '@shared/date'
import { APPOINTMENT_LABELS, NOTE_KIND_LABELS, STATUS_LABELS } from '@shared/labels'
import {
  SLOT_NOTE_KINDS,
  type Appointment,
  type JournalSlotNote,
  type JournalSlotView,
  type SlotNoteKind,
  type SlotStatus
} from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { call, tryCall } from '@/lib/api'
import { alpha, frTime } from '@/lib/format'
import { SubjectIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<SlotStatus, string> = {
  prevu: 'border-slate-300 text-slate-600',
  fait: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  partiel: 'border-amber-400 bg-amber-50 text-amber-700',
  reporte: 'border-orange-400 bg-orange-50 text-orange-700',
  annule: 'border-slate-400 bg-slate-100 text-slate-500'
}

const NOTE_STYLE: Record<SlotNoteKind, string> = {
  retard: 'bg-amber-100 text-amber-800',
  imprevu: 'bg-red-100 text-red-800',
  differenciation: 'bg-sky-100 text-sky-800',
  comportement: 'bg-orange-100 text-orange-800',
  reussite: 'bg-emerald-100 text-emerald-800',
  autre: 'bg-slate-100 text-slate-700'
}

export function DayView({
  date,
  slots,
  appointments,
  onChanged,
  onOpenSlot,
  onOpenAppointment,
  onNewSlot,
  onNewAppointment
}: {
  date: string
  slots: JournalSlotView[]
  appointments: Appointment[]
  onChanged: () => void
  onOpenSlot: (s: JournalSlotView) => void
  onOpenAppointment: (a: Appointment) => void
  onNewSlot: () => void
  onNewAppointment: () => void
}): React.JSX.Element {
  const daySlots = slots.filter((s) => s.date === date)
  const dayAppointments = appointments.filter((a) => a.date === date)
  const done = daySlots.filter((s) => s.status === 'fait').length

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">
            Déroulé de la journée {daySlots.length > 0 && `· ${done}/${daySlots.length} fait(s)`}
          </h2>
          <Button variant="ghost" size="sm" onClick={onNewSlot}>
            <Plus /> Créneau
          </Button>
        </div>
        {daySlots.map((s) => (
          <SlotCard key={s.id} slot={s} onChanged={onChanged} onEdit={() => onOpenSlot(s)} />
        ))}
      </section>

      <aside className="flex flex-col gap-5">
        <DayNote date={date} />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase">Rendez-vous</h2>
            <Button variant="ghost" size="sm" onClick={onNewAppointment}>
              <Plus /> Ajouter
            </Button>
          </div>
          {dayAppointments.length === 0 && <p className="text-sm text-muted-foreground">Aucun rendez-vous.</p>}
          <ul className="flex flex-col gap-2">
            {dayAppointments.map((a) => (
              <li key={a.id}>
                <button onClick={() => onOpenAppointment(a)} className="w-full rounded-lg border border-violet-200 bg-violet-50 p-3 text-left text-sm hover:bg-violet-100">
                  <div className="flex items-center gap-2 font-medium text-violet-900">
                    <CalendarClock className="size-4" /> {frTime(a.start_time)} – {frTime(a.end_time)}
                    <Badge className="ml-auto border-violet-300 bg-white">{APPOINTMENT_LABELS[a.kind]}</Badge>
                  </div>
                  <div className="mt-1">{a.title}</div>
                  {a.location && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {a.location}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

function SlotCard({ slot, onChanged, onEdit }: { slot: JournalSlotView; onChanged: () => void; onEdit: () => void }): React.JSX.Element {
  const [notes, setNotes] = useState<JournalSlotNote[]>([])
  const [bilan, setBilan] = useState(slot.bilan)
  const [pendingKind, setPendingKind] = useState<SlotNoteKind | null>(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => setBilan(slot.bilan), [slot.bilan])
  useEffect(() => {
    void tryCall('journal:notes', slot.id).then((n) => n && setNotes(n))
  }, [slot.id, slot.notes_count])

  const setStatus = async (status: SlotStatus): Promise<void> => {
    if (await tryCall('journal:update', slot.id, { status: slot.status === status ? 'prevu' : status })) onChanged()
  }

  const saveBilan = async (): Promise<void> => {
    if (bilan !== slot.bilan && (await tryCall('journal:update', slot.id, { bilan }))) onChanged()
  }

  const addNote = async (e?: React.FormEvent): Promise<void> => {
    e?.preventDefault()
    if (!pendingKind) return
    const note = await tryCall('journal:add-note', slot.id, pendingKind, noteText.trim())
    if (note) {
      setNotes((n) => [...n, note])
      setPendingKind(null)
      setNoteText('')
      onChanged()
    }
  }

  const removeNote = async (id: number): Promise<void> => {
    await call('journal:delete-note', id)
    setNotes((n) => n.filter((x) => x.id !== id))
    onChanged()
  }

  const minutes = timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time)

  return (
    <article
      className={cn('rounded-xl border bg-card shadow-xs', slot.status === 'annule' && 'opacity-60')}
      style={{ borderLeft: `6px solid ${slot.subject_color ?? '#64748b'}` }}
    >
      <header className="flex items-start gap-3 px-4 pt-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: alpha(slot.subject_color, 0.14), color: slot.subject_color ?? undefined }}>
          <SubjectIcon icon={slot.subject_icon} className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3" /> {frTime(slot.start_time)} – {frTime(slot.end_time)} · {minutes} min
            {slot.socle_domain && <Badge className="py-0">{slot.socle_domain}</Badge>}
          </div>
          <h3 className="truncate font-semibold">
            {slot.subject_name ?? 'Créneau'}
            {slot.title && <span className="font-normal text-muted-foreground"> — {slot.title}</span>}
          </h3>
          {slot.lesson_id && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground/80">
              <BookMarked className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                {slot.sequence_title && <span className="text-muted-foreground">{slot.sequence_title} · </span>}
                {slot.lesson_title}
                {slot.lesson_objective && <span className="block text-xs text-muted-foreground">Objectif : {slot.lesson_objective}</span>}
              </span>
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Modifier le créneau">
          <Pencil />
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        {(['fait', 'partiel', 'reporte', 'annule'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition',
              slot.status === s ? STATUS_STYLE[s] : 'border-dashed text-muted-foreground hover:bg-muted'
            )}
            aria-pressed={slot.status === s}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {SLOT_NOTE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setPendingKind(pendingKind === k ? null : k)}
            className={cn('rounded-full px-2.5 py-0.5 text-xs', pendingKind === k ? 'ring-2 ring-ring' : '', NOTE_STYLE[k])}
          >
            + {NOTE_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {pendingKind && (
        <form onSubmit={addNote} className="flex gap-2 px-4 pt-2">
          <Input autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={`${NOTE_KIND_LABELS[pendingKind]} : précisez (facultatif)…`} />
          <Button type="submit" size="sm" className="h-9">
            Ajouter
          </Button>
        </form>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 px-4 pt-2">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-center gap-2 text-sm">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', NOTE_STYLE[n.kind])}>{NOTE_KIND_LABELS[n.kind]}</span>
              <span className="flex-1">{n.content}</span>
              <button className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100" onClick={() => removeNote(n.id)} aria-label="Supprimer la remarque">
                <Trash2 className="size-3.5 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="p-4 pt-2">
        <Textarea
          value={bilan}
          onChange={(e) => setBilan(e.target.value)}
          onBlur={saveBilan}
          placeholder="Bilan de séance : ce qui a fonctionné, à reprendre, élèves à revoir…"
          className="min-h-14 resize-y border-dashed text-sm"
        />
      </div>
    </article>
  )
}

function DayNote({ date }: { date: string }): React.JSX.Element {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  useEffect(() => {
    void tryCall('journal:day-note', date).then((v) => {
      setValue(v ?? '')
      setSaved(v ?? '')
    })
  }, [date])
  const save = async (): Promise<void> => {
    if (value === saved) return
    await tryCall('journal:set-day-note', date, value)
    setSaved(value)
  }
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground uppercase">Note du jour</h2>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Absences, sortie, intervenant, météo de la classe…"
        className="min-h-28"
      />
    </div>
  )
}
