import type {
  AppSettings,
  Appointment,
  AppointmentInput,
  CustomFont,
  DbStatus,
  JournalSlotInput,
  JournalSlotNote,
  JournalSlotView,
  LessonSummary,
  ProjectionState,
  SetupInput,
  SlotNoteKind,
  SlotStatus,
  SocleDomain,
  StudentSummary,
  Subject,
  TimetableSlot
} from './types'

export type SlotPatch = Partial<JournalSlotInput> & { status?: SlotStatus; bilan?: string }
export type ProjectionPatch = Partial<Omit<ProjectionState, 'timer'>> & { timer?: Partial<ProjectionState['timer']> }

/**
 * Contrat unique entre l'interface et le processus principal.
 * Chaque canal est une fonction (arguments) → résultat ; le preload n'expose
 * que ces canaux, rien d'autre (pas d'accès Node dans l'interface).
 */
export interface IpcContract {
  'db:status': () => DbStatus
  'db:unlock': (passphrase: string) => DbStatus
  'db:setup': (input: SetupInput) => DbStatus
  'db:change-passphrase': (next: string | null) => DbStatus
  'db:lock': () => DbStatus

  'settings:get': () => AppSettings
  'settings:update': (patch: Partial<AppSettings>) => AppSettings

  'ref:subjects': () => Subject[]
  'ref:socle': () => SocleDomain[]
  'ref:lessons': () => LessonSummary[]
  'ref:students': () => StudentSummary[]

  'journal:range': (from: string, to: string) => JournalSlotView[]
  'journal:create': (input: JournalSlotInput) => JournalSlotView
  'journal:update': (id: number, patch: SlotPatch) => JournalSlotView
  'journal:delete': (id: number) => void
  'journal:notes': (slotId: number) => JournalSlotNote[]
  'journal:add-note': (slotId: number, kind: SlotNoteKind, content: string) => JournalSlotNote
  'journal:delete-note': (noteId: number) => void
  'journal:day-note': (date: string) => string
  'journal:set-day-note': (date: string, content: string) => void

  'timetable:get': () => TimetableSlot[]
  'timetable:save-week': (weekStart: string) => number
  'timetable:apply-week': (weekStart: string) => number

  'appointments:range': (from: string, to: string) => Appointment[]
  'appointments:create': (input: AppointmentInput) => Appointment
  'appointments:update': (id: number, input: AppointmentInput) => Appointment
  'appointments:delete': (id: number) => void

  'students:export': (id: number) => string | null
  'students:erase': (id: number) => void

  'backup:export': (passphrase: string | null) => string | null
  'backup:import': (passphrase: string | null) => boolean

  'projection:open': () => void
  'projection:close': () => void
  'projection:is-open': () => boolean
  'projection:get': () => ProjectionState
  'projection:set': (patch: ProjectionPatch) => ProjectionState

  'fonts:get': () => CustomFont | null
  'fonts:import': () => CustomFont | null
  'fonts:remove': () => void
}

export type Channel = keyof IpcContract

export const CHANNELS: readonly Channel[] = [
  'db:status', 'db:unlock', 'db:setup', 'db:change-passphrase', 'db:lock',
  'settings:get', 'settings:update',
  'ref:subjects', 'ref:socle', 'ref:lessons', 'ref:students',
  'journal:range', 'journal:create', 'journal:update', 'journal:delete',
  'journal:notes', 'journal:add-note', 'journal:delete-note', 'journal:day-note', 'journal:set-day-note',
  'timetable:get', 'timetable:save-week', 'timetable:apply-week',
  'appointments:range', 'appointments:create', 'appointments:update', 'appointments:delete',
  'students:export', 'students:erase',
  'backup:export', 'backup:import',
  'projection:open', 'projection:close', 'projection:is-open', 'projection:get', 'projection:set',
  'fonts:get', 'fonts:import', 'fonts:remove'
]

/** Événements poussés par le processus principal vers les fenêtres. */
export interface IpcEvents {
  'projection:state': ProjectionState
  'projection:window': boolean
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface DinaBridge {
  invoke<C extends Channel>(
    channel: C,
    ...args: Parameters<IpcContract[C]>
  ): Promise<IpcResult<ReturnType<IpcContract[C]>>>
  on<E extends keyof IpcEvents>(event: E, listener: (payload: IpcEvents[E]) => void): () => void
}
