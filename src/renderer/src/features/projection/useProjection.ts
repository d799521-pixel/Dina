import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectionPatch } from '@shared/ipc'
import type { ProjectionState, TimerState } from '@shared/types'
import { call } from '@/lib/api'

/** État du tableau, synchronisé entre le pupitre et l'écran projeté. */
export function useProjectionState(): [ProjectionState | undefined, (patch: ProjectionPatch) => void] {
  const [state, setState] = useState<ProjectionState>()
  useEffect(() => {
    void call('projection:get').then(setState)
    return window.dina.on('projection:state', setState)
  }, [])
  const update = useCallback((patch: ProjectionPatch) => {
    setState((s) => (s ? { ...s, ...patch, timer: { ...s.timer, ...patch.timer } } : s))
    void call('projection:set', patch)
  }, [])
  return [state, update]
}

export function useProjectionWindowOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    void call('projection:is-open').then(setOpen)
    return window.dina.on('projection:window', setOpen)
  }, [])
  return open
}

export function remainingSeconds(t: TimerState, now = Date.now()): number {
  return t.ends_at === null ? t.remaining_s : Math.max(0, (t.ends_at - now) / 1000)
}

/** Re-rendu régulier tant que le minuteur tourne. */
export function useTimerTick(t: TimerState | undefined): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!t || t.ends_at === null) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [t?.ends_at, t])
  return now
}

/** Joue un carillon (synthétisé, aucun fichier audio) quand le minuteur atteint zéro. */
export function useTimerChime(t: TimerState | undefined, enabled: boolean): void {
  const firedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!enabled || !t || t.ends_at === null) return
    const endsAt = t.ends_at
    const delay = endsAt - Date.now()
    if (delay < -2000 || firedFor.current === endsAt) return
    const id = setTimeout(() => {
      firedFor.current = endsAt
      chime()
    }, Math.max(0, delay))
    return () => clearTimeout(id)
  }, [t?.ends_at, enabled, t])
}

function chime(): void {
  const ctx = new AudioContext()
  ;[0, 0.35, 0.7].forEach((offset, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = [880, 1108.7, 1318.5][i]
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset)
    gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 1.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(ctx.currentTime + offset)
    osc.stop(ctx.currentTime + offset + 1.3)
  })
  setTimeout(() => void ctx.close(), 2500)
}
