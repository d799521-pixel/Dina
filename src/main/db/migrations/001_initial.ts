// Schéma initial complet : année / classe, référentiels, préparations,
// cahier journal, emploi du temps type, rendez-vous, élèves, projection.
//
// Règles :
//  - toutes les données d'un élève dépendent de `students` via ON DELETE CASCADE,
//    de sorte qu'un seul DELETE suffit à exercer le droit à l'effacement ;
//  - les liens « faibles » (créneau → séance, observation → créneau) utilisent
//    ON DELETE SET NULL pour ne jamais perdre l'historique du journal.

export const up = /* sql */ `
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON
);

-- ------------------------------------------------------------------ Année, périodes, classe
CREATE TABLE school_years (
  id          INTEGER PRIMARY KEY,
  label       TEXT NOT NULL UNIQUE,        -- « 2026-2027 »
  start_date  TEXT,
  end_date    TEXT
);

CREATE TABLE periods (
  id              INTEGER PRIMARY KEY,
  school_year_id  INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  number          INTEGER NOT NULL CHECK (number BETWEEN 1 AND 5),
  label           TEXT NOT NULL,
  start_date      TEXT,
  end_date        TEXT,
  UNIQUE (school_year_id, number)
);

CREATE TABLE classes (
  id              INTEGER PRIMARY KEY,
  school_year_id  INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  levels          TEXT NOT NULL DEFAULT '[]'   -- JSON : ["CE1","CE2"]
);

-- ------------------------------------------------------------------ Référentiels
CREATE TABLE subjects (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  short_name  TEXT NOT NULL,
  color       TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'book',
  position    INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

CREATE TABLE socle_domains (
  code   TEXT PRIMARY KEY,         -- D1.1 … D5
  label  TEXT NOT NULL
);

CREATE TABLE competencies (
  id          INTEGER PRIMARY KEY,
  subject_id  INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  cycle       INTEGER CHECK (cycle IN (1, 2, 3)),
  code        TEXT,
  label       TEXT NOT NULL
);

-- ------------------------------------------------------------------ Programmations / progressions
CREATE TABLE sequences (
  id                      INTEGER PRIMARY KEY,
  class_id                INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id              INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  period_id               INTEGER REFERENCES periods(id) ON DELETE SET NULL,
  title                   TEXT NOT NULL,
  levels                  TEXT NOT NULL DEFAULT '[]',
  socle_domain            TEXT REFERENCES socle_domains(code),
  general_objectives      TEXT NOT NULL DEFAULT '',
  prerequisites           TEXT NOT NULL DEFAULT '',
  planned_sessions_count  INTEGER,
  success_criteria        TEXT NOT NULL DEFAULT '',
  final_assessment        TEXT NOT NULL DEFAULT '',
  notes                   TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sequences_class_period ON sequences(class_id, period_id, subject_id);

CREATE TABLE sequence_competencies (
  sequence_id    INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  PRIMARY KEY (sequence_id, competency_id)
);

-- Programmation annuelle : quoi, dans quelle période ; « position » = progression.
CREATE TABLE programming_items (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id   INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  period_id    INTEGER REFERENCES periods(id) ON DELETE SET NULL,
  sequence_id  INTEGER REFERENCES sequences(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_programming_class ON programming_items(class_id, subject_id, period_id, position);

-- ------------------------------------------------------------------ Séances (fiches de préparation)
CREATE TABLE lessons (
  id                   INTEGER PRIMARY KEY,
  class_id             INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  sequence_id          INTEGER REFERENCES sequences(id) ON DELETE SET NULL,
  subject_id           INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  number_in_sequence   INTEGER,
  title                TEXT NOT NULL,
  specific_objective   TEXT NOT NULL DEFAULT '',
  duration_min         INTEGER,
  materials            TEXT NOT NULL DEFAULT '',
  success_criteria     TEXT NOT NULL DEFAULT '',
  differentiation      TEXT NOT NULL DEFAULT '',
  institutionalization TEXT NOT NULL DEFAULT '',
  assessment           TEXT NOT NULL DEFAULT '',
  notes                TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lessons_sequence ON lessons(sequence_id, number_in_sequence);

CREATE TABLE lesson_steps (
  id                INTEGER PRIMARY KEY,
  lesson_id         INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,
  title             TEXT NOT NULL,
  duration_min      INTEGER,
  work_mode         TEXT NOT NULL DEFAULT 'collectif'
                    CHECK (work_mode IN ('individuel', 'binome', 'groupe', 'collectif')),
  teacher_role      TEXT NOT NULL DEFAULT '',
  student_activity  TEXT NOT NULL DEFAULT '',
  materials         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_lesson_steps ON lesson_steps(lesson_id, position);

-- ------------------------------------------------------------------ Emploi du temps type
CREATE TABLE timetable_templates (
  id        INTEGER PRIMARY KEY,
  class_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name      TEXT NOT NULL
);

CREATE TABLE timetable_slots (
  id           INTEGER PRIMARY KEY,
  template_id  INTEGER NOT NULL REFERENCES timetable_templates(id) ON DELETE CASCADE,
  weekday      INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  subject_id   INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  label        TEXT NOT NULL DEFAULT '',
  CHECK (start_time < end_time)
);

-- ------------------------------------------------------------------ Cahier journal
CREATE TABLE journal_slots (
  id            INTEGER PRIMARY KEY,
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  subject_id    INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT '',
  socle_domain  TEXT REFERENCES socle_domains(code),
  lesson_id     INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  sequence_id   INTEGER REFERENCES sequences(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'prevu'
                CHECK (status IN ('prevu', 'fait', 'partiel', 'reporte', 'annule')),
  bilan         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (start_time < end_time)
);
CREATE INDEX idx_journal_slots_date ON journal_slots(class_id, date, start_time);
CREATE INDEX idx_journal_slots_lesson ON journal_slots(lesson_id);

-- Remarques rapides saisies en direct pendant la séance.
CREATE TABLE journal_slot_notes (
  id          INTEGER PRIMARY KEY,
  slot_id     INTEGER NOT NULL REFERENCES journal_slots(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
              CHECK (kind IN ('retard', 'imprevu', 'differenciation', 'comportement', 'reussite', 'autre')),
  content     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_slot_notes ON journal_slot_notes(slot_id);

CREATE TABLE journal_day_notes (
  class_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  content   TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (class_id, date)
);

-- ------------------------------------------------------------------ Élèves (données personnelles)
CREATE TABLE students (
  id          INTEGER PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  last_name   TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  birth_date  TEXT,
  level       TEXT NOT NULL DEFAULT '',
  entry_date  TEXT,
  leave_date  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_students_class ON students(class_id, last_name, first_name);

CREATE TABLE student_contacts (
  id                 INTEGER PRIMARY KEY,
  student_id         INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name          TEXT NOT NULL,
  relation           TEXT NOT NULL DEFAULT '',     -- mère, père, tuteur, assistante maternelle…
  phone              TEXT NOT NULL DEFAULT '',
  phone_alt          TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  is_legal_guardian  INTEGER NOT NULL DEFAULT 0 CHECK (is_legal_guardian IN (0, 1)),
  is_emergency       INTEGER NOT NULL DEFAULT 0 CHECK (is_emergency IN (0, 1)),
  can_pick_up        INTEGER NOT NULL DEFAULT 0 CHECK (can_pick_up IN (0, 1)),
  priority           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE student_authorizations (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,      -- photo, sortie_proximite, sortie_scolaire, transport, diffusion_ent…
  granted     INTEGER NOT NULL CHECK (granted IN (0, 1)),
  signed_on   TEXT,
  comment     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (student_id, kind)
);

-- Données de santé : catégorie particulière (art. 9 RGPD), table séparée.
CREATE TABLE student_health (
  student_id     INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  allergies      TEXT NOT NULL DEFAULT '',
  has_pai        INTEGER NOT NULL DEFAULT 0 CHECK (has_pai IN (0, 1)),
  pai_details    TEXT NOT NULL DEFAULT '',
  medical_notes  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE student_accommodations (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('PAP', 'PPRE', 'PPS', 'PAI', 'tiers_temps', 'autre')),
  start_date  TEXT,
  end_date    TEXT,
  details     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE student_observations (
  id               INTEGER PRIMARY KEY,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'general',
  content          TEXT NOT NULL,
  journal_slot_id  INTEGER REFERENCES journal_slots(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_observations_student ON student_observations(student_id, date);

-- ------------------------------------------------------------------ Rendez-vous
CREATE TABLE appointments (
  id            INTEGER PRIMARY KEY,
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('parents', 'rased', 'equipe', 'ess', 'conseil', 'autre')),
  title         TEXT NOT NULL,
  location      TEXT NOT NULL DEFAULT '',
  participants  TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  report        TEXT NOT NULL DEFAULT '',      -- compte rendu
  CHECK (start_time < end_time)
);
CREATE INDEX idx_appointments_date ON appointments(class_id, date, start_time);

CREATE TABLE appointment_students (
  appointment_id  INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (appointment_id, student_id)
);

-- ------------------------------------------------------------------ Mode projection
CREATE TABLE board_presets (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  payload  TEXT NOT NULL          -- JSON (texte, police, lignage…)
);
`
