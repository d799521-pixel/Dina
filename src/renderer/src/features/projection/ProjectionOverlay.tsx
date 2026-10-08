import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Clock, ListOrdered, Moon, Pause, PenLine, Play, RotateCcw, X } from 'lucide-react'
import type { ProjectionScene } from '@shared/types'
import { call } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCustomFont } from './boardFonts'
import { useTodaySlots } from './DayProgram'
import { Stage } from './Stage'
import { remainingSeconds, useProjectionState, useTimerChime, useTimerTick } from './useProjection'

const SCENES: { value: ProjectionScene; icon: React.ReactNode; label: string }[] = [
  { value: 'accueil', icon: <CalendarDays />, label: 'Date' },
  { value: 'consigne', icon: <PenLine />, label: 'Consigne' },
  { value: 'programme', icon: <ListOrdered />, label: 'Programme' },
  { value: 'minuteur', icon: <Clock />, label: 'Minuteur' },
  { value: 'noir', icon: <Moon />, label: 'Noir' }
]

/**
 * Version iPad du tableau : la scène occupe tout l'écran (recopiée sur le
 * vidéoprojecteur par AirPlay ou câble). Un toucher affiche quelques commandes.
 */
export function ProjectionOverlay(): React.JSX.Element | null {
  const [state, update] = useProjectionState()
  const { slots, nowMin } = useTodaySlots()
  const now = useTimerTick(state?.timer)
  useTimerChime(state?.timer, true)
  useCustomFont(state?.font_rev ?? 0)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showControls = (): void => {
    setControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControls(false), 4000)
  }
  useEffect(() => {
    showControls()
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
    return () => {
      clearTimeout(hideTimer.current)
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined)
    }
  }, [])

  if (!state) return null
  const t = state.timer
  const running = t.ends_at !== null

  return (
    <div className="fixed inset-0 z-[150] bg-white" onPointerDown={showControls}>
      <Stage state={state} slots={slots} nowMin={nowMin} now={now} />
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-black/50 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity',
          controls ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        {SCENES.map((s) => (
          <button
            key={s.value}
            onClick={() => update({ scene: s.value })}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg [&_svg]:size-4',
              state.scene === s.value ? 'bg-primary text-primary-foreground' : 'bg-white/95 text-slate-800'
            )}
          >
            {s.icon} {s.label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/60" />
        <button
          onClick={() =>
            running
              ? update({ timer: { ends_at: null, remaining_s: remainingSeconds(t) } })
              : update({ timer: { ends_at: Date.now() + (remainingSeconds(t) || t.duration_s) * 1000, remaining_s: remainingSeconds(t) || t.duration_s } })
          }
          className="flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2.5 text-sm font-medium text-slate-800 shadow-lg [&_svg]:size-4"
        >
          {running ? <Pause /> : <Play />} Minuteur
        </button>
        <button
          onClick={() => update({ timer: { ends_at: null, remaining_s: t.duration_s } })}
          className="rounded-full bg-white/95 p-2.5 text-slate-800 shadow-lg [&_svg]:size-4"
          aria-label="Réinitialiser le minuteur"
        >
          <RotateCcw />
        </button>
        <button
          onClick={() => call('projection:close')}
          className="flex items-center gap-1.5 rounded-full bg-slate-900/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg [&_svg]:size-4"
        >
          <X /> Quitter
        </button>
      </div>
    </div>
  )
}
