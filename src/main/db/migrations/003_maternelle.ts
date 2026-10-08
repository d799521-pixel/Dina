// Maternelle et cahier journal enrichi :
//  - domaines d'apprentissage du programme 2024-2026 (six domaines) et temps
//    propres à la maternelle (regroupement, sieste, pause méridienne…) ;
//  - objectifs d'apprentissage du programme officiel, par âge (référentiel) ;
//  - créneaux destinés à un groupe (PS, GS, groupe 1…), texte « Activités »
//    et photos jointes, comme dans un cahier journal papier.

import programme from '../data/programme-maternelle-2024.json'

const q = (s: string): string => `'${s.replaceAll("'", "''")}'`

/** Nom des domaines dans le texte officiel → nom de la matière dans Dina. */
const DOMAIN_SUBJECT: Record<string, string> = {
  'Développement et structuration du langage oral et écrit': 'Développement et structuration du langage oral et écrit',
  'Agir, s’exprimer, comprendre à travers les activités physiques': "Agir, s'exprimer, comprendre à travers les activités physiques",
  'Agir, s’exprimer, comprendre à travers les activités artistiques': "Agir, s'exprimer, comprendre à travers les activités artistiques",
  'Acquisition des premiers outils mathématiques': 'Acquisition des premiers outils mathématiques',
  'Se repérer dans le temps et l’espace': "Se repérer dans le temps et l'espace",
  'Découvrir le monde du vivant, de la matière et des objets': 'Découvrir le monde du vivant, de la matière et des objets'
}

const maternelleActive = `(SELECT CASE WHEN EXISTS (SELECT 1 FROM subjects WHERE position >= 100 AND archived = 0) THEN 0 ELSE 1 END)`

const objectives = programme.objectives
  .map(
    (o, i) =>
      `((SELECT id FROM subjects WHERE name = ${q(DOMAIN_SUBJECT[o.domain])}), 1, ${q(o.level)}, ${q(o.area)}, ${q(o.skill)}, ${q(o.label)}, ${i})`
  )
  .join(',\n')

export const up = /* sql */ `
ALTER TABLE journal_slots ADD COLUMN audience TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_slots ADD COLUMN activities TEXT NOT NULL DEFAULT '';
ALTER TABLE timetable_slots ADD COLUMN audience TEXT NOT NULL DEFAULT '';

CREATE TABLE journal_slot_images (
  id        INTEGER PRIMARY KEY,
  slot_id   INTEGER NOT NULL REFERENCES journal_slots(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  mime      TEXT NOT NULL,
  data      BLOB NOT NULL,
  caption   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_slot_images ON journal_slot_images(slot_id, position);

-- Domaines du programme 2024-2026 (renommage des anciens intitulés).
UPDATE subjects SET name = 'Développement et structuration du langage oral et écrit', short_name = 'Langage'
 WHERE name = 'Mobiliser le langage dans toutes ses dimensions';
UPDATE subjects SET name = 'Agir, s''exprimer, comprendre à travers les activités physiques', short_name = 'Motricité'
 WHERE name = 'Agir, s''exprimer, comprendre à travers l''activité physique';
UPDATE subjects SET name = 'Acquisition des premiers outils mathématiques', short_name = 'Outils maths'
 WHERE name = 'Acquérir les premiers outils mathématiques';
UPDATE subjects SET name = 'Découvrir le monde du vivant, de la matière et des objets', short_name = 'Découvrir le monde', icon = 'flask'
 WHERE name = 'Explorer le monde';
UPDATE subjects SET name = 'Vivre ensemble (EVAR)', short_name = 'Vivre ensemble'
 WHERE name = 'Apprendre ensemble et vivre ensemble';

INSERT INTO subjects (name, short_name, color, icon, position, archived) VALUES
  ('Se repérer dans le temps et l''espace', 'Temps & espace', '#0d9488', 'clock', 104, ${maternelleActive}),
  ('Regroupement',      'Regroupement', '#6366f1', 'users',    110, ${maternelleActive}),
  ('Temps calme / sieste', 'Calme / sieste', '#94a3b8', 'moon', 111, ${maternelleActive}),
  ('Pause méridienne',  'Pause repas',  '#94a3b8', 'utensils', 112, ${maternelleActive}),
  ('Multi-domaine',     'Multi-domaine', '#a855f7', 'layers',  113, ${maternelleActive});
UPDATE subjects SET position = 105 WHERE name = 'Découvrir le monde du vivant, de la matière et des objets';
UPDATE subjects SET position = 106 WHERE name = 'Vivre ensemble (EVAR)';

-- Référentiel : objectifs d'apprentissage du programme de maternelle.
ALTER TABLE competencies ADD COLUMN level TEXT;
ALTER TABLE competencies ADD COLUMN area TEXT NOT NULL DEFAULT '';
ALTER TABLE competencies ADD COLUMN skill TEXT NOT NULL DEFAULT '';
ALTER TABLE competencies ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_competencies_subject ON competencies(subject_id, level, position);
INSERT INTO competencies (subject_id, cycle, level, area, skill, label, position) VALUES
${objectives};
`
