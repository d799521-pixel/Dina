import { useState } from 'react'
import { BookMarked, CalendarDays, MonitorPlay, Settings, Users, type LucideIcon } from 'lucide-react'
import type { DbStatus } from '@shared/types'
import { cn } from '@/lib/utils'
import { JournalPage } from '../journal/JournalPage'
import { BoardConsole } from '../projection/BoardConsole'
import { SettingsPage } from '../settings/SettingsPage'
import { PreparationsPage } from '../preparations/PreparationsPage'
import { StudentsPage } from '../students/StudentsPage'

type Page = 'journal' | 'preparations' | 'eleves' | 'tableau' | 'parametres'

const NAV: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'journal', label: 'Cahier journal', icon: CalendarDays },
  { id: 'preparations', label: 'Préparations', icon: BookMarked },
  { id: 'eleves', label: 'Élèves', icon: Users },
  { id: 'tableau', label: 'Tableau', icon: MonitorPlay },
  { id: 'parametres', label: 'Paramètres', icon: Settings }
]

export function Shell({ status, onStatusChange }: { status: DbStatus; onStatusChange: (s: DbStatus) => void }): React.JSX.Element {
  const [page, setPage] = useState<Page>('journal')

  return (
    <div className="flex h-full">
      <nav className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="px-5 pt-5 pb-4">
          <div className="font-cursive text-2xl text-primary">Dina</div>
          <div className="mt-1 truncate text-xs text-muted-foreground" title={status.current_class?.name}>
            {status.current_class?.name}
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => setPage(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
                  page === id ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t px-5 py-3 text-[11px] leading-snug text-muted-foreground">
          {status.encrypted ? '🔒 Base chiffrée' : 'Base non chiffrée'} · hors-ligne
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-hidden">
        {page === 'journal' && <JournalPage />}
        {page === 'tableau' && <BoardConsole />}
        {page === 'parametres' && <SettingsPage status={status} onStatusChange={onStatusChange} />}
        {page === 'preparations' && <PreparationsPage />}
        {page === 'eleves' && <StudentsPage className={status.current_class?.name ?? ''} />}
      </main>
    </div>
  )
}
