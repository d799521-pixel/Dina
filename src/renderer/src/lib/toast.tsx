import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { cn } from './utils'

interface Toast {
  id: number
  kind: 'error' | 'success'
  message: string
}

let listeners: ((t: Toast) => void)[] = []
let nextId = 1

function push(kind: Toast['kind'], message: string): void {
  const t = { id: nextId++, kind, message }
  listeners.forEach((l) => l(t))
}

export const notify = (message: string): void => push('success', message)
export const notifyError = (err: unknown): void => push('error', err instanceof Error ? err.message : String(err))

export function Toaster(): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    const l = (t: Toast): void => {
      setToasts((all) => [...all, t])
      setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 4500)
    }
    listeners.push(l)
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg',
            t.kind === 'error' && 'border-destructive/40 text-destructive'
          )}
        >
          {t.kind === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
