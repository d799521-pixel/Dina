// Types du domaine partagés entre le processus principal (SQLite) et l'interface.
// Conventions : dates « YYYY-MM-DD », heures « HH:MM », horodatages ISO 8601.

export type ID = number

export const WORK_MODES = ['individuel', 'binome', 'groupe', 'collectif'] as const
export type WorkMode = (typeof WORK_MODES)[number]

export const SLOT_STATUSES = ['prevu', 'fait', 'partiel', 'reporte', 'annule'] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

export const SLOT_NOTE_KINDS = ['retard', 'imprevu', 'differenciation', 'comportement', 'reussite', 'autre'] as const
export type SlotNoteKind = (typeof SLOT_NOTE_KINDS)[number]

export const APPOINTMENT_KINDS = ['parents', 'rased', 'equipe', 'ess', 'conseil', 'autre'] as const
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number]

export const ACCOMMODATION_TYPES = ['PAP', 'PPRE', 'PPS', 'PAI', 'tiers_temps', 'autre'] as const
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number]

export interface Subject {
  id: ID
  name: string
  short_name: string
  color: string
  icon: string
  position: number
  archived: 0 | 1
}

export interface SocleDomain {
  code: string
  label: string
}

export interface SchoolClass {
  id: ID
  school_year_id: ID
  name: string
  levels: string[]
}

export interface Period {
  id: ID
  school_year_id: ID
  number: number
  label: string
  start_date: string | null
  end_date: string | null
}

export interface LessonSummary {
  id: ID
  title: string
  subject_id: ID | null
  sequence_id: ID | null
  sequence_title: string | null
  number_in_sequence: number | null
  specific_objective: string
  duration_min: number | null
}

export interface JournalSlot {
  id: ID
  class_id: ID
  date: string
  start_time: string
  end_time: string
  subject_id: ID | null
  title: string
  socle_domain: string | null
  lesson_id: ID | null
  sequence_id: ID | null
  status: SlotStatus
  bilan: string
  created_at: string
  updated_at: string
}

/** Créneau enrichi pour l'affichage (jointures matière / séance / compteur de remarques). */
export interface JournalSlotView extends JournalSlot {
  subject_name: string | null
  subject_short: string | null
  subject_color: string | null
  subject_icon: string | null
  lesson_title: string | null
  lesson_objective: string | null
  sequence_title: string | null
  notes_count: number
}

export interface JournalSlotInput {
  date: string
  start_time: string
  end_time: string
  subject_id: ID | null
  title: string
  socle_domain: string | null
  lesson_id: ID | null
}

export interface JournalSlotNote {
  id: ID
  slot_id: ID
  kind: SlotNoteKind
  content: string
  created_at: string
}

export interface Appointment {
  id: ID
  class_id: ID
  date: string
  start_time: string
  end_time: string
  kind: AppointmentKind
  title: string
  location: string
  participants: string
  notes: string
  report: string
  student_ids: ID[]
}

export type AppointmentInput = Omit<Appointment, 'id' | 'class_id'>

export interface TimetableSlot {
  id: ID
  template_id: ID
  weekday: number // 1 = lundi … 7 = dimanche (ISO)
  start_time: string
  end_time: string
  subject_id: ID | null
  label: string
}

export interface StudentSummary {
  id: ID
  first_name: string
  last_name: string
  level: string
}

export interface AppSettings {
  school_days: number[]
  day_start: string
  day_end: string
}

export type DbState = 'new' | 'locked' | 'open'

export interface DbStatus {
  state: DbState
  encrypted: boolean
  path: string
  current_class: SchoolClass | null
}

export interface SetupInput {
  passphrase: string | null
  class_name: string
  levels: string[]
  school_year_label: string
  demo: boolean
}

// ---------------------------------------------------------------------------
// Mode projection : l'état est tenu par le processus principal et diffusé
// à toutes les fenêtres (pupitre de l'enseignant + écran projeté).

export type ProjectionScene = 'accueil' | 'consigne' | 'programme' | 'minuteur' | 'noir'
export type BoardFont = 'cursive' | 'script' | 'capitales' | 'dys' | 'perso'
export type Ruling = 'seyes' | 'double' | 'aucune'

export interface TimerState {
  duration_s: number
  /** Horodatage (ms) de fin si le minuteur tourne, sinon null. */
  ends_at: number | null
  /** Secondes restantes quand le minuteur est en pause. */
  remaining_s: number
}

export interface ProjectionState {
  scene: ProjectionScene
  text: string
  font: BoardFont
  ruling: Ruling
  /** Hauteur d’un interligne Seyès en pixels pour un écran de 1280 px de large (mis à l’échelle). */
  unit_px: number
  /** Hauteur des lettres minuscules, en interlignes (1 = CE/CM, 2 = CP). */
  x_height_units: 1 | 2
  ink: string
  show_margin: boolean
  show_timer_overlay: boolean
  /** Incrémenté à chaque import de police personnelle pour forcer son rechargement. */
  font_rev: number
  timer: TimerState
}

export const DEFAULT_PROJECTION: ProjectionState = {
  scene: 'accueil',
  text: 'Recopie la date et le titre.',
  font: 'cursive',
  ruling: 'seyes',
  unit_px: 22,
  x_height_units: 2,
  ink: '#1e2a78',
  show_margin: true,
  show_timer_overlay: false,
  font_rev: 0,
  timer: { duration_s: 300, ends_at: null, remaining_s: 300 }
}

export interface CustomFont {
  name: string
  data: Uint8Array
}
