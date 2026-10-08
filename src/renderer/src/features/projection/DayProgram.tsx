import { useEffect, useState } from 'react'
import { timeToMinutes, today } from '@shared/date'
import type { JournalSlotView } from '@shared/types'
import { call } from '@/lib/api'
import { alpha, frTime } from '@/lib/format'
import { SubjectIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

/** Créneaux du jour, rafraîchis chaque minute (pour suivre le créneau en cours). */
export function useTodaySlots(): { slots: JournalSlotView[]; nowMin: number } {
  const [slots, setSlots] = useState<JournalSlotView[]>([])
  const [nowMin, setNowMin] = useState(0)
  useEffect(() => {
    const load = (): void => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
      const t = today()
      void call('journal:range', t, t)
        .then((s) => setSlots(s.filter((x) => x.status !== 'annule')))
        .catch(() => setSlots([]))
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])
  return { slots, nowMin }
}

const label = (s: JournalSlotView): string => s.subject_short ?? s.title ?? 'Activité'

/** Programme de la journée en pictogrammes, pour les élèves. */
export function DayProgram({ slots, nowMin, scale, layout }: { slots: JournalSlotView[]; nowMin: number; scale: number; layout: 'row' | 'column' }): React.JSX.Element {
  if (slots.length === 0) {
    return <p className="text-center text-slate-500" style={{ fontSize: 28 * scale }}>Pas de programme saisi pour aujourd’hui.</p>
  }
  return (
    <ol
      className={cn(
        'gap-[0.5em]',
        layout === 'row' ? 'flex flex-wrap justify-center' : slots.length > 5 ? 'grid grid-cols-2' : 'flex flex-col'
      )} style={{ fontSize: 22 * scale, fontFamily: 'Andika, sans-serif' }}>
      {slots.map((s) => {
        const current = nowMin >= timeToMinutes(s.start_time) && nowMin < timeToMinutes(s.end_time)
        const past = nowMin >= timeToMinutes(s.end_time)
        const color = s.subject_color ?? '#64748b'
        return (
          <li
            key={s.id}
            className={cn('flex items-center gap-[0.5em] rounded-[0.6em] border-[0.12em] px-[0.6em] py-[0.35em] transition', past && 'opacity-40', current && 'scale-105 shadow-lg')}
            style={{ borderColor: current ? color : alpha(color, 0.35), background: alpha(color, current ? 0.18 : 0.07) }}
          >
            <span className="flex size-[2em] shrink-0 items-center justify-center rounded-full" style={{ background: color, color: '#fff' }}>
              <SubjectIcon icon={s.subject_icon} className="size-[1.2em]" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-bold" style={{ color }}>{label(s)}</span>
              {layout === 'column' && s.title && s.title !== label(s) && <span className="text-[0.8em] text-slate-600">{s.title}</span>}
              <span className="text-[0.7em] text-slate-500">{frTime(s.start_time)} – {frTime(s.end_time)}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
