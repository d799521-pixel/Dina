import { addDays, isoWeekday, today } from '@shared/date'
import type { AppSettings, Appointment, JournalSlotView } from '@shared/types'
import { fmt, frTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function MonthView({
  month,
  from,
  to,
  settings,
  slots,
  appointments,
  onOpenDay
}: {
  month: string
  from: string
  to: string
  settings: AppSettings
  slots: JournalSlotView[]
  appointments: Appointment[]
  onOpenDay: (date: string) => void
}): React.JSX.Element {
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  const todayIso = today()

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const daySlots = slots.filter((s) => s.date === d)
          const dayAppts = appointments.filter((a) => a.date === d)
          const done = daySlots.filter((s) => s.status === 'fait').length
          const isSchoolDay = settings.school_days.includes(isoWeekday(d))
          return (
            <button
              key={d}
              onClick={() => onOpenDay(d)}
              className={cn(
                'flex min-h-28 flex-col gap-1 rounded-md border p-1.5 text-left text-xs hover:border-primary/50',
                isSchoolDay ? 'bg-card' : 'bg-muted/60',
                d.slice(0, 7) !== month.slice(0, 7) && 'opacity-40'
              )}
            >
              <span className={cn('flex size-6 items-center justify-center rounded-full text-sm font-medium', d === todayIso && 'bg-primary text-primary-foreground')}>
                {fmt(d, 'd')}
              </span>
              {daySlots.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-0.5">
                    {daySlots.map((s) => (
                      <span key={s.id} className="h-1.5 w-3 rounded-full" style={{ background: s.subject_color ?? '#94a3b8' }} title={`${s.subject_short ?? ''} ${s.title}`} />
                    ))}
                  </div>
                  <span className="text-muted-foreground">
                    {daySlots.length} créneaux{done > 0 && ` · ${done} fait(s)`}
                  </span>
                </>
              )}
              {dayAppts.map((a) => (
                <span key={a.id} className="truncate rounded bg-violet-100 px-1 text-violet-900">
                  {frTime(a.start_time)} {a.title}
                </span>
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
