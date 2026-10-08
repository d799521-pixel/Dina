import { useCallback, useEffect, useState } from 'react'
import { Camera, CameraOff, HeartPulse, Search, UserPlus, Users } from 'lucide-react'
import type { StudentListItem } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tryCall } from '@/lib/api'
import { cn } from '@/lib/utils'
import { StudentEditor } from './StudentEditor'

export function StudentsPage({ className }: { className: string }): React.JSX.Element {
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [showLeft, setShowLeft] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | 'new' | null>(null)

  const load = useCallback(() => {
    void tryCall('students:list', showLeft).then((s) => s && setStudents(s))
  }, [showLeft])
  useEffect(load, [load])

  const q = query.trim().toLowerCase()
  const visible = students.filter((s) => !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q))
  const withPai = students.filter((s) => s.has_pai || s.allergies.trim()).length

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r bg-card">
        <div className="flex flex-col gap-2 border-b p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Élèves</h1>
            <span className="text-xs text-muted-foreground">
              {students.length} élève(s){withPai > 0 && ` · ${withPai} santé`}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" />
          </div>
          <Button onClick={() => setSelected('new')}>
            <UserPlus /> Ajouter un élève
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {visible.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setSelected(s.id)}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted', selected === s.id && 'bg-accent')}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-800">
                  {s.first_name[0]}
                  {s.last_name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-medium">{s.first_name}</span> {s.last_name}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {s.level && <span className="text-[11px] text-muted-foreground">{s.level}</span>}
                    {s.accommodations.map((a) => (
                      <Badge key={a} className="border-sky-300 bg-sky-50 px-1.5 py-0 text-[10px] text-sky-800">{a === 'tiers_temps' ? '⅓ temps' : a}</Badge>
                    ))}
                  </span>
                </span>
                {(s.has_pai === 1 || s.allergies.trim() !== '') && <HeartPulse className="size-4 shrink-0 text-red-600" aria-label="PAI / allergie" />}
                {s.photo_ok === 0 && <CameraOff className="size-4 shrink-0 text-amber-600" aria-label="Pas de photo" />}
              </button>
            </li>
          ))}
          {students.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Aucun élève. Ajoutez votre classe pour suivre les fiches de renseignements.</li>
          )}
        </ul>
        <label className="flex items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showLeft} onChange={(e) => setShowLeft(e.target.checked)} />
          Afficher les élèves partis
        </label>
      </aside>

      <section className="min-h-0 overflow-y-auto">
        {selected !== null ? (
          <StudentEditor
            key={selected}
            studentId={selected}
            className={className}
            onSaved={(id) => {
              load()
              setSelected(id)
            }}
            onErased={() => {
              load()
              setSelected(null)
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
            <Users className="size-10" />
            Sélectionnez un élève pour consulter sa fiche.
            <span className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><HeartPulse className="size-3.5 text-red-600" /> PAI / allergie</span>
              <span className="flex items-center gap-1"><CameraOff className="size-3.5 text-amber-600" /> pas de droit à l’image</span>
              <span className="flex items-center gap-1"><Camera className="size-3.5" /> autorisations dans la fiche</span>
            </span>
          </div>
        )}
      </section>
    </div>
  )
}
