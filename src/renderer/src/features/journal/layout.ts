import { timeToMinutes } from '@shared/date'

export interface Timed {
  start_time: string
  end_time: string
}

export interface Placed<T> {
  item: T
  lane: number
  lanes: number
}

/**
 * Répartit des événements qui se chevauchent en colonnes (« lanes »),
 * à la manière des agendas : chaque groupe de chevauchements partage la largeur.
 */
export function placeInLanes<T extends Timed>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time) || b.end_time.localeCompare(a.end_time))
  const result: Placed<T>[] = []
  let cluster: Placed<T>[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = (): void => {
    for (const p of cluster) p.lanes = laneEnds.length
    result.push(...cluster)
    cluster = []
    laneEnds = []
  }

  for (const item of sorted) {
    const start = timeToMinutes(item.start_time)
    const end = timeToMinutes(item.end_time)
    if (start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((e) => e <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else laneEnds[lane] = end
    cluster.push({ item, lane, lanes: 0 })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return result
}
