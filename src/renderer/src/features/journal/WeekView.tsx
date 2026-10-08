import { useEffect, useState } from 'react'
import { BookMarked, Check, CircleSlash, MessageSquareText, Redo2, Users } from 'lucide-react'
import { addDays, minutesToTime, timeToMinutes, today } from '@shared/date'
import { APPOINTMENT_LABELS } from '@shared/labels'
import type { AppSettings, Appointment, JournalSlotView } from '@shared/types'
import { SubjectIcon } from '@/lib/icons'
import { alpha, fmt, frTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { placeInLanes } from './layout'

const PX_PER_MIN = 1.15
const SNAP_MIN = 15

type Item = { kind: 'slot'; start_time: string; end_time: string; slot: JournalSlotView } | { kind: 'appt'; start_time: string; end_time: string; appt: Appointment }

function useNowMinutes(): number {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now.getHours() * 60 + now.getMinutes()
}

export function WeekView({
  weekStart,
  settings,
  slots,
  appointments,
  onCreate,
  onOpenSlot,
  onOpenAppointment,
  onOpenDay
}: {
  weekStart: string
  settings: AppSettings
  slots: JournalSlotView[]
  appointments: Appointment[]
  onCreate: (date: string, start: string, end: string) => void
  onOpenSlot: (s: JournalSlotView) => void
  onOpenAppointment: (a: Appointment) => void
  onOpenDay: (date: string) => void
}): React.JSX.Element {
  const nowMin = useNowMinutes()
  const todayIso = today()

  // Affiche les jours de classe + tout jour qui contient des événements.
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(
    (d, i) =>
      settings.school_days.includes(i + 1) || slots.some((s) => s.date === d) || appointments.some((a) => a.date === d)
  )

  const times = [...slots, ...appointments].flatMap((x) => [timeToMinutes(x.start_time), timeToMinutes(x.end_time)])
  const startMin = Math.floor(Math.min(timeToMinutes(settings.day_start), ...times) / 60) * 60
  const endMin = Math.ceil(Math.max(timeToMinutes(settings.day_end), ...times) / 60) * 60
  const height = (endMin - startMin) * PX_PER_MIN
  const hours = Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin + i * 60)

  const createAt = (date: string, e: React.MouseEvent<HTMLDivElement>): void => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const min = Math.floor((startMin + y / PX_PER_MIN) / SNAP_MIN) * SNAP_MIN
    onCreate(date, minutesToTime(min), minutesToTime(Math.min(min + 45, 23 * 60 + 59)))
  }

  return (
    <div className="min-w-[720px] p-4">
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <button
            key={d}
            onClick={() => onOpenDay(d)}
            className={cn(
              'mx-1 mb-2 rounded-md py-1.5 text-center text-sm hover:bg-accent',
              d === todayIso && 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <span className="capitalize">{fmt(d, 'EEEE')}</span> <span className="font-semibold">{fmt(d, 'd')}</span>
          </button>
        ))}

        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <div key={m} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground" style={{ top: (m - startMin) * PX_PER_MIN }}>
              {frTime(minutesToTime(m))}
            </div>
          ))}
        </div>

        {days.map((d) => {
          const items: Item[] = [
            ...slots.filter((s) => s.date === d).map((slot) => ({ kind: 'slot' as const, start_time: slot.start_time, end_time: slot.end_time, slot })),
            ...appointments.filter((a) => a.date === d).map((appt) => ({ kind: 'appt' as const, start_time: appt.start_time, end_time: appt.end_time, appt }))
          ]
          return (
            <div
              key={d}
              className={cn('relative mx-1 rounded-md border bg-card', d === todayIso && 'ring-1 ring-primary/30')}
              style={{ height }}
              onClick={(e) => e.target === e.currentTarget && createAt(d, e)}
              title="Cliquer pour ajouter un créneau"
            >
              {hours.map((m) => (
                <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: (m - startMin) * PX_PER_MIN }} />
              ))}
              {d === todayIso && nowMin >= startMin && nowMin <= endMin && (
                <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500" style={{ top: (nowMin - startMin) * PX_PER_MIN }}>
                  <div className="-mt-[5px] -ml-1 size-2 rounded-full bg-red-500" />
                </div>
              )}
              {placeInLanes(items).map(({ item, lane, lanes }) => {
                const top = (timeToMinutes(item.start_time) - startMin) * PX_PER_MIN
                const h = Math.max(18, (timeToMinutes(item.end_time) - timeToMinutes(item.start_time)) * PX_PER_MIN - 2)
                const style = { top, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }
                return item.kind === 'slot' ? (
                  <SlotBlock key={`s${item.slot.id}`} slot={item.slot} style={style} onClick={() => onOpenSlot(item.slot)} />
                ) : (
                  <AppointmentBlock key={`a${item.appt.id}`} appt={item.appt} style={style} onClick={() => onOpenAppointment(item.appt)} />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlotBlock({ slot, style, onClick }: { slot: JournalSlotView; style: React.CSSProperties; onClick: () => void }): React.JSX.Element {
  const compact = (style.height as number) < 40
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-xs transition hover:z-30 hover:shadow-md',
        slot.status === 'annule' && 'opacity-50 line-through'
      )}
      style={{ ...style, borderLeftColor: slot.subject_color ?? '#64748b', background: alpha(slot.subject_color, 0.12) }}
      title={`${frTime(slot.start_time)}–${frTime(slot.end_time)} · ${slot.subject_name ?? ''} ${slot.title}`}
    >
      <div className="flex items-center gap-1 font-medium" style={{ color: slot.subject_color ?? undefined }}>
        <SubjectIcon icon={slot.subject_icon} className="size-3 shrink-0" />
        <span className="truncate">{slot.subject_short ?? 'Créneau'}</span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-muted-foreground">
          {slot.lesson_id && <BookMarked className="size-3" aria-label="Fiche de préparation liée" />}
          {slot.notes_count > 0 && (
            <span className="flex items-center" aria-label={`${slot.notes_count} remarque(s)`}>
              <MessageSquareText className="size-3" />
              {slot.notes_count}
            </span>
          )}
          {slot.status === 'fait' && <Check className="size-3 text-emerald-600" aria-label="Fait" />}
          {slot.status === 'partiel' && <Check className="size-3 text-amber-500" aria-label="Partiel" />}
          {slot.status === 'reporte' && <Redo2 className="size-3 text-amber-600" aria-label="Reporté" />}
          {slot.status === 'annule' && <CircleSlash className="size-3" aria-label="Annulé" />}
        </span>
      </div>
      {!compact && <div className="truncate text-foreground/80">{slot.title || slot.lesson_title}</div>}
    </button>
  )
}

function AppointmentBlock({ appt, style, onClick }: { appt: Appointment; style: React.CSSProperties; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="absolute z-10 overflow-hidden rounded-md border border-dashed border-violet-400 bg-[repeating-linear-gradient(135deg,#f5f3ff,#f5f3ff_6px,#ede9fe_6px,#ede9fe_12px)] px-1.5 py-0.5 text-left text-xs text-violet-900 hover:z-30 hover:shadow-md"
      style={style}
      title={`${APPOINTMENT_LABELS[appt.kind]} — ${appt.title}`}
    >
      <div className="flex items-center gap-1 font-medium">
        <Users className="size-3 shrink-0" />
        <span className="truncate">{APPOINTMENT_LABELS[appt.kind]}</span>
      </div>
      <div className="truncate">{appt.title}</div>
    </button>
  )
}
