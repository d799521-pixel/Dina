import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Clock,
  ListOrdered,
  Minus,
  MonitorPlay,
  MonitorX,
  Moon,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Type,
  Upload
} from 'lucide-react'
import type { BoardFont, ProjectionScene, Ruling } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { call, tryCall } from '@/lib/api'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { BOARD_FONTS, useCustomFont } from './boardFonts'
import { useTodaySlots } from './DayProgram'
import { Stage } from './Stage'
import { remainingSeconds, useProjectionState, useProjectionWindowOpen, useTimerChime, useTimerTick } from './useProjection'

const SCENES: { value: ProjectionScene; label: string; icon: React.ReactNode }[] = [
  { value: 'accueil', label: 'Date & journée', icon: <CalendarDays /> },
  { value: 'consigne', label: 'Consigne', icon: <PenLine /> },
  { value: 'programme', label: 'Programme', icon: <ListOrdered /> },
  { value: 'minuteur', label: 'Minuteur', icon: <Clock /> },
  { value: 'noir', label: 'Écran noir', icon: <Moon /> }
]

const INKS = [
  { value: '#1e2a78', label: 'Bleu' },
  { value: '#111827', label: 'Noir' },
  { value: '#15803d', label: 'Vert' },
  { value: '#b91c1c', label: 'Rouge' }
]

const PRESETS = [1, 2, 3, 5, 10, 15, 20, 30]

/** Pupitre de l'enseignant : pilote l'écran projeté et en montre un aperçu fidèle. */
export function BoardConsole(): React.JSX.Element | null {
  const [state, update] = useProjectionState()
  const isWeb = window.dina.platform === 'web'
  const windowOpen = useProjectionWindowOpen()
  const { slots, nowMin } = useTodaySlots()
  const now = useTimerTick(state?.timer)
  const customFontName = useCustomFont(state?.font_rev ?? 0)
  // Le carillon sonne sur le pupitre seulement si l'écran projeté est fermé.
  useTimerChime(state?.timer, !windowOpen)

  // Le texte est édité localement pour ne pas perdre le curseur pendant la frappe.
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => {
    if (state && draft === null) setDraft(state.text)
  }, [state, draft])

  if (!state) return null
  const t = state.timer
  const running = t.ends_at !== null

  const setDuration = (seconds: number): void =>
    update({ timer: { duration_s: seconds, remaining_s: seconds, ends_at: null } })
  const start = (): void => {
    const rem = remainingSeconds(t) || t.duration_s
    update({ timer: { ends_at: Date.now() + rem * 1000, remaining_s: rem } })
  }
  const pause = (): void => update({ timer: { ends_at: null, remaining_s: remainingSeconds(t) } })
  const reset = (): void => update({ timer: { ends_at: null, remaining_s: t.duration_s } })

  const importFont = async (): Promise<void> => {
    const font = await tryCall('fonts:import')
    if (font) {
      update({ font: 'perso', font_rev: state.font_rev + 1 })
      notify(`Police « ${font.name} » importée.`)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b bg-card px-5 py-3">
        <h1 className="text-lg font-semibold">Tableau de classe</h1>
        <Segmented
          className="ml-4"
          value={state.scene}
          onChange={(scene) => update({ scene })}
          options={SCENES.map((s) => ({ value: s.value, label: <>{s.icon} {s.label}</> }))}
        />
        <div className="ml-auto">
          {windowOpen ? (
            <Button variant="outline" onClick={() => call('projection:close')}>
              <MonitorX /> Fermer la projection
            </Button>
          ) : (
            <Button onClick={() => call('projection:open')}>
              <MonitorPlay /> {isWeb ? 'Plein écran' : 'Projeter'}
            </Button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] overflow-hidden">
        <aside className="flex flex-col gap-6 overflow-y-auto border-r bg-card p-5">
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Type className="size-4" /> Écriture
            </h2>
            <Textarea
              value={draft ?? ''}
              onChange={(e) => {
                setDraft(e.target.value)
                update({ text: e.target.value })
              }}
              onFocus={() => state.scene !== 'consigne' && update({ scene: 'consigne' })}
              className="min-h-28 font-cursive text-base leading-relaxed"
              placeholder="Tapez la consigne à projeter…"
            />
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(BOARD_FONTS) as BoardFont[]).map((f) => (
                <button
                  key={f}
                  onClick={() => (f === 'perso' && !customFontName ? importFont() : update({ font: f }))}
                  className={cn('rounded-md border px-2 py-1.5 text-sm', state.font === f ? 'border-primary bg-accent font-medium' : 'hover:bg-muted')}
                  style={{ fontFamily: `"${BOARD_FONTS[f].family}"` }}
                  title={f === 'perso' ? customFontName ?? 'Importer une police (Belle Allure…)' : BOARD_FONTS[f].label}
                >
                  {f === 'perso' ? (customFontName ?? 'Importer…') : BOARD_FONTS[f].uppercase ? 'ABC' : f === 'cursive' ? 'écriture' : 'abc'}
                </button>
              ))}
            </div>
            <button onClick={importFont} className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
              <Upload className="size-3" /> Importer ma police cursive (.ttf, .otf, .woff2)
            </button>

            <Segmented<Ruling>
              value={state.ruling}
              onChange={(ruling) => update({ ruling })}
              options={[
                { value: 'seyes', label: 'Seyès' },
                { value: 'double', label: 'Double ligne' },
                { value: 'aucune', label: 'Sans lignes' }
              ]}
            />
            <Segmented<1 | 2>
              value={state.x_height_units}
              onChange={(x_height_units) => update({ x_height_units })}
              options={[
                { value: 2, label: 'Grand (CP)', title: 'Minuscules sur 2 interlignes' },
                { value: 1, label: 'Standard', title: 'Minuscules sur 1 interligne' }
              ]}
            />
            <label className="flex items-center gap-3 text-sm">
              <span className="w-14 text-muted-foreground">Taille</span>
              <input type="range" min={8} max={40} value={state.unit_px} onChange={(e) => update({ unit_px: Number(e.target.value) })} className="flex-1" />
            </label>
            <div className="flex items-center gap-2">
              <span className="w-14 text-sm text-muted-foreground">Encre</span>
              {INKS.map((ink) => (
                <button
                  key={ink.value}
                  onClick={() => update({ ink: ink.value })}
                  className={cn('size-7 rounded-full border-2', state.ink === ink.value ? 'border-ring' : 'border-transparent')}
                  style={{ background: ink.value }}
                  aria-label={ink.label}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={state.show_margin} onChange={(e) => update({ show_margin: e.target.checked })} />
              Marge rouge
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4" /> Minuteur
            </h2>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(m * 60)}
                  className={cn('rounded-md border px-2.5 py-1 text-sm tabular-nums', t.duration_s === m * 60 ? 'border-primary bg-accent font-medium' : 'hover:bg-muted')}
                >
                  {m} min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setDuration(Math.max(30, t.duration_s - 30))} aria-label="Moins 30 secondes">
                <Minus />
              </Button>
              <span className="flex-1 text-center text-2xl font-semibold tabular-nums">
                {Math.floor(Math.ceil(remainingSeconds(t, now)) / 60)}:{String(Math.ceil(remainingSeconds(t, now)) % 60).padStart(2, '0')}
              </span>
              <Button variant="outline" size="icon" onClick={() => setDuration(t.duration_s + 30)} aria-label="Plus 30 secondes">
                <Plus />
              </Button>
            </div>
            <div className="flex gap-2">
              {running ? (
                <Button className="flex-1" variant="secondary" onClick={pause}>
                  <Pause /> Pause
                </Button>
              ) : (
                <Button className="flex-1" onClick={start}>
                  <Play /> Démarrer
                </Button>
              )}
              <Button variant="outline" onClick={reset} aria-label="Réinitialiser">
                <RotateCcw />
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={state.show_timer_overlay} onChange={(e) => update({ show_timer_overlay: e.target.checked })} />
              Afficher le minuteur dans un coin des autres scènes
            </label>
          </section>
        </aside>

        <section className="flex min-h-0 flex-col items-center justify-center gap-3 bg-muted p-6">
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg border-4 border-slate-800 shadow-2xl">
            <Stage state={state} slots={slots} nowMin={nowMin} now={now} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isWeb
              ? 'Aperçu fidèle · « Plein écran » affiche le tableau sur tout l’iPad : activez la recopie d’écran (AirPlay ou câble) pour le projeter'
              : <>Aperçu fidèle de l’écran projeté · dans la fenêtre de projection : <kbd>F</kbd> plein écran, <kbd>Échap</kbd> quitter</>}
          </p>
        </section>
      </div>
    </div>
  )
}
