import { useEffect } from 'react'
import { Stage } from './Stage'
import { useCustomFont } from './boardFonts'
import { useTodaySlots } from './DayProgram'
import { useProjectionState, useTimerChime, useTimerTick } from './useProjection'

/** Fenêtre affichée sur le vidéoprojecteur / TBI. F ou F11 : plein écran, Échap : quitter. */
export function ProjectionScreen(): React.JSX.Element | null {
  const [state] = useProjectionState()
  const { slots, nowMin } = useTodaySlots()
  const now = useTimerTick(state?.timer)
  useTimerChime(state?.timer, true)
  useCustomFont(state?.font_rev ?? 0)

  useEffect(() => {
    document.title = 'Dina — Tableau'
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  if (!state) return null
  return (
    <div className="h-screen w-screen">
      <Stage state={state} slots={slots} nowMin={nowMin} now={now} />
    </div>
  )
}
