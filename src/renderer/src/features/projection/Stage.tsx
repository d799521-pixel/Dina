import { today } from '@shared/date'
import type { JournalSlotView, ProjectionState } from '@shared/types'
import { fmt, longDate } from '@/lib/format'
import { useSize } from '@/lib/useSize'
import { DayProgram } from './DayProgram'
import { REFERENCE_WIDTH, SeyesBoard } from './SeyesBoard'
import { TimerDial } from './TimerDial'
import { remainingSeconds } from './useProjection'

/**
 * Rendu d'une scène du tableau. Tout est proportionnel à la largeur afin que
 * l'aperçu du pupitre et l'écran projeté affichent exactement la même chose.
 */
export function Stage({ state, slots, nowMin, now }: { state: ProjectionState; slots: JournalSlotView[]; nowMin: number; now: number }): React.JSX.Element {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const scale = width / REFERENCE_WIDTH
  const timerVisible =
    state.show_timer_overlay && state.scene !== 'minuteur' && (state.timer.ends_at !== null || remainingSeconds(state.timer, now) < state.timer.duration_s)

  const board = (text: string, h: number, fitLines?: number): React.JSX.Element => (
    <SeyesBoard
      text={text}
      font={state.font}
      ruling={state.ruling}
      unitPx={state.unit_px}
      xHeightUnits={state.x_height_units}
      ink={state.ink}
      showMargin={state.show_margin}
      width={width}
      height={h}
      fontRev={state.font_rev}
      fitLines={fitLines}
    />
  )

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden bg-[#fffef9]">
      {width > 0 && (
        <>
          {state.scene === 'accueil' && (
            <div className="flex h-full flex-col">
              <div className="shrink-0 overflow-hidden" style={{ height: height * 0.42 }}>
                {board(longDate(today()), height * 0.42, 1)}
              </div>
              <div className="flex flex-1 items-center justify-center overflow-hidden px-[3%]">
                <DayProgram slots={slots} nowMin={nowMin} scale={scale * 1.25} layout="row" />
              </div>
            </div>
          )}
          {state.scene === 'consigne' && board(state.text, height)}
          {state.scene === 'programme' && (
            <div className="flex h-full flex-col px-[6%] py-[3%]">
              <h2 className="mb-[0.6em] font-cursive text-indigo-900" style={{ fontSize: 40 * scale }}>
                Programme du {fmt(today(), 'EEEE d MMMM')}
              </h2>
              <div className="min-h-0 flex-1 overflow-hidden">
                <DayProgram slots={slots} nowMin={nowMin} scale={scale * 1.1} layout="column" />
              </div>
            </div>
          )}
          {state.scene === 'minuteur' && (
            <div className="flex h-full items-center justify-center">
              <TimerDial timer={state.timer} now={now} size={Math.min(width, height) * 0.68} />
            </div>
          )}
          {state.scene === 'noir' && <div className="absolute inset-0 bg-black" />}
          {timerVisible && (
            <div className="absolute top-[3%] right-[2%] rounded-2xl bg-white/90 p-[0.6%] shadow-lg">
              <TimerDial timer={state.timer} now={now} size={Math.min(width, height) * 0.16} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
