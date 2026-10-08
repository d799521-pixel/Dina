import type { JournalSlotView } from '@shared/types'

const toMin = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Regroupe les créneaux qui se chevauchent dans le temps. */
export function overlapGroups(slots: JournalSlotView[]): JournalSlotView[][] {
  const out: JournalSlotView[][] = []
  let end = -1
  for (const s of [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.audience.localeCompare(b.audience))) {
    if (out.length === 0 || toMin(s.start_time) >= end) {
      out.push([s])
      end = toMin(s.end_time)
    } else {
      out[out.length - 1].push(s)
      end = Math.max(end, toMin(s.end_time))
    }
  }
  return out
}

/**
 * Répartit un groupe de créneaux simultanés en colonnes : une colonne par
 * groupe d'élèves, où les créneaux s'enchaînent (ex. GS : temps calme →
 * phonologie → ateliers, pendant que les PS font la sieste). Deux créneaux
 * du même groupe à la même heure (ateliers) occupent des colonnes distinctes.
 */
export function columns(group: JournalSlotView[]): JournalSlotView[][] {
  const cols: { audience: string; end: number; slots: JournalSlotView[] }[] = []
  for (const s of group) {
    const start = toMin(s.start_time)
    const col = cols.find((c) => c.audience === s.audience && c.end <= start)
    if (col) {
      col.slots.push(s)
      col.end = toMin(s.end_time)
    } else cols.push({ audience: s.audience, end: toMin(s.end_time), slots: [s] })
  }
  return cols.map((c) => c.slots)
}
