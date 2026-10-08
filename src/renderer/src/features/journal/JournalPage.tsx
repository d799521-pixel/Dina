import { useState } from 'react'
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, CopyCheck, Plus, Wand2 } from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  isoWeekday,
  startOfMonth,
  startOfWeek,
  today
} from '@shared/date'
import type { Appointment, JournalSlotView } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { call, tryCall, useQuery } from '@/lib/api'
import { fmt, longDate } from '@/lib/format'
import { notify } from '@/lib/toast'
import { AppointmentDialog, type AppointmentDraft } from './AppointmentDialog'
import { DayView } from './DayView'
import { MonthView } from './MonthView'
import { SlotDialog, type SlotDraft } from './SlotDialog'
import { useJournalRefs } from './useJournalRefs'
import { WeekView } from './WeekView'

type View = 'jour' | 'semaine' | 'mois'

function rangeOf(view: View, anchor: string): [string, string] {
  if (view === 'jour') return [anchor, anchor]
  if (view === 'semaine') {
    const start = startOfWeek(anchor)
    return [start, addDays(start, 6)]
  }
  const start = startOfWeek(startOfMonth(anchor))
  const end = endOfMonth(anchor)
  return [start, addDays(end, 7 - isoWeekday(end))]
}

function title(view: View, anchor: string): string {
  if (view === 'jour') return longDate(anchor)
  if (view === 'mois') return fmt(anchor, 'MMMM yyyy').replace(/^./, (c) => c.toUpperCase())
  const start = startOfWeek(anchor)
  const end = addDays(start, 6)
  return start.slice(0, 7) === end.slice(0, 7)
    ? `${fmt(start, 'd')} – ${fmt(end, 'd MMMM yyyy')}`
    : `${fmt(start, 'd MMM')} – ${fmt(end, 'd MMM yyyy')}`
}

export function JournalPage(): React.JSX.Element {
  const [view, setView] = useState<View>('semaine')
  const [anchor, setAnchor] = useState(today())
  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null)
  const [apptDraft, setApptDraft] = useState<AppointmentDraft | null>(null)
  const { refs, reloadRefs } = useJournalRefs()

  const [from, to] = rangeOf(view, anchor)
  const { data, reload } = useQuery(
    async () => {
      const [slots, appointments] = await Promise.all([call('journal:range', from, to), call('appointments:range', from, to)])
      return { slots, appointments }
    },
    [from, to]
  )

  const move = (dir: -1 | 1): void => {
    if (view === 'jour') {
      // Saute les jours sans classe (ex. mercredi, week-end).
      let next = addDays(anchor, dir)
      const days = refs?.settings.school_days ?? [1, 2, 3, 4, 5]
      for (let i = 0; i < 7 && !days.includes(isoWeekday(next)); i++) next = addDays(next, dir)
      setAnchor(next)
    } else if (view === 'semaine') setAnchor(addDays(anchor, 7 * dir))
    else setAnchor(addMonths(anchor, dir))
  }

  const openDay = (date: string): void => {
    setAnchor(date)
    setView('jour')
  }

  const newSlot = (date = view === 'jour' ? anchor : today(), start = '09:00', end = '10:00'): void =>
    setSlotDraft({ date, start_time: start, end_time: end })

  const newAppointment = (date = view === 'jour' ? anchor : today()): void =>
    setApptDraft({ date, start_time: '16:45', end_time: '17:30' })

  const applyTimetable = async (): Promise<void> => {
    const n = await tryCall('timetable:apply-week', anchor)
    if (n === undefined) return
    notify(n === 0 ? 'Aucun créneau ajouté (emploi du temps vide ou déjà appliqué).' : `${n} créneau(x) ajouté(s) depuis l’emploi du temps.`)
    reload()
  }

  const saveTimetable = async (): Promise<void> => {
    const n = await tryCall('timetable:save-week', anchor)
    if (n !== undefined) notify(`Emploi du temps type enregistré (${n} créneaux).`)
  }

  const slots: JournalSlotView[] = data?.slots ?? []
  const appointments: Appointment[] = data?.appointments ?? []

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b bg-card px-5 py-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Précédent">
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(today())}>
            Aujourd’hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Suivant">
            <ChevronRight />
          </Button>
        </div>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title(view, anchor)}</h1>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'jour', label: 'Jour' },
            { value: 'semaine', label: 'Semaine' },
            { value: 'mois', label: 'Mois' }
          ]}
        />
        {view === 'semaine' && (
          <>
            <Button variant="outline" onClick={applyTimetable} title="Pré-remplir la semaine avec l’emploi du temps type">
              <Wand2 /> Emploi du temps
            </Button>
            <Button variant="ghost" size="icon" onClick={saveTimetable} title="Enregistrer cette semaine comme emploi du temps type">
              <CopyCheck />
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => newAppointment()}>
          <CalendarClock /> Rendez-vous
        </Button>
        <Button onClick={() => newSlot()}>
          <Plus /> Créneau
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {!refs ? null : view === 'semaine' ? (
          <WeekView
            weekStart={from}
            settings={refs.settings}
            slots={slots}
            appointments={appointments}
            onCreate={(date, start, end) => newSlot(date, start, end)}
            onOpenSlot={(s) => setSlotDraft(s)}
            onOpenAppointment={(a) => setApptDraft(a)}
            onOpenDay={openDay}
          />
        ) : view === 'jour' ? (
          <DayView
            date={anchor}
            slots={slots}
            appointments={appointments}
            onChanged={reload}
            onOpenSlot={(s) => setSlotDraft(s)}
            onOpenAppointment={(a) => setApptDraft(a)}
            onNewSlot={() => newSlot(anchor)}
            onNewAppointment={() => newAppointment(anchor)}
          />
        ) : (
          <MonthView month={anchor} from={from} to={to} settings={refs.settings} slots={slots} appointments={appointments} onOpenDay={openDay} />
        )}
        {refs && view !== 'mois' && slots.length === 0 && (
          <div className="mx-auto mt-6 mb-10 flex max-w-md flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <CalendarPlus className="size-8" />
            Aucun créneau sur cette période. Cliquez dans la grille, ajoutez un créneau ou appliquez votre emploi du temps type.
          </div>
        )}
      </div>

      {refs && slotDraft && (
        <SlotDialog
          draft={slotDraft}
          refs={refs}
          onClose={() => setSlotDraft(null)}
          onSaved={() => {
            setSlotDraft(null)
            reload()
            reloadRefs()
          }}
        />
      )}
      {refs && apptDraft && (
        <AppointmentDialog
          draft={apptDraft}
          students={refs.students}
          onClose={() => setApptDraft(null)}
          onSaved={() => {
            setApptDraft(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
