import { useCallback, useEffect, useRef, useState } from 'react'
import type { Channel, IpcContract } from '@shared/ipc'
import { notifyError } from './toast'

/** Appel typé vers le processus principal ; lève une Error lisible en cas d'échec. */
export async function call<C extends Channel>(
  channel: C,
  ...args: Parameters<IpcContract[C]>
): Promise<ReturnType<IpcContract[C]>> {
  const res = await window.dina.invoke(channel, ...args)
  if (!res.ok) throw new Error(res.error)
  return res.data
}

/** Variante qui affiche l'erreur dans une notification et renvoie undefined. */
export async function tryCall<C extends Channel>(
  channel: C,
  ...args: Parameters<IpcContract[C]>
): Promise<ReturnType<IpcContract[C]> | undefined> {
  try {
    return await call(channel, ...args)
  } catch (err) {
    notifyError(err)
    return undefined
  }
}

/** Petit hook de chargement : `data`, `reload()` et état de chargement. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; reload: () => void; loading: boolean } {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadRef.current()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && notifyError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, reload, loading }
}
