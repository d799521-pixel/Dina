import type { TimerState } from '@shared/types'
import { cn } from '@/lib/utils'
import { remainingSeconds } from './useProjection'

const fmt = (s: number): string => {
  const total = Math.ceil(s)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Minuteur visuel « disque qui se vide » : lisible par des élèves non lecteurs. */
export function TimerDial({ timer, now, size, showDigits = true }: { timer: TimerState; now: number; size: number; showDigits?: boolean }): React.JSX.Element {
  const remaining = remainingSeconds(timer, now)
  const fraction = timer.duration_s > 0 ? Math.min(1, remaining / timer.duration_s) : 0
  const r = 45
  const angle = fraction * 2 * Math.PI
  const x = 50 + r * Math.sin(angle)
  const y = 50 - r * Math.cos(angle)
  const large = fraction > 0.5 ? 1 : 0
  const finished = remaining <= 0
  const color = fraction > 0.25 ? '#e2445c' : '#f59e0b'

  return (
    <div className="flex flex-col items-center gap-[0.04em]" style={{ fontSize: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className={cn(finished && 'animate-pulse')}>
        <circle cx={50} cy={50} r={48} fill="#fff" stroke="#1f2937" strokeWidth={2} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={50} y1={4} x2={50} y2={i % 3 === 0 ? 10 : 7} stroke="#1f2937" strokeWidth={i % 3 === 0 ? 1.6 : 0.8} transform={`rotate(${i * 30} 50 50)`} />
        ))}
        {fraction >= 0.9999 ? (
          <circle cx={50} cy={50} r={r} fill={color} />
        ) : fraction > 0 ? (
          <path d={`M50 50 L50 ${50 - r} A${r} ${r} 0 ${large} 1 ${x} ${y} Z`} fill={color} />
        ) : null}
        <circle cx={50} cy={50} r={4} fill="#1f2937" />
      </svg>
      {showDigits && (
        <div className={cn('font-semibold tabular-nums', finished ? 'text-red-600' : 'text-slate-800')} style={{ fontSize: size * 0.18 }}>
          {finished ? 'Terminé !' : fmt(remaining)}
        </div>
      )}
    </div>
  )
}
