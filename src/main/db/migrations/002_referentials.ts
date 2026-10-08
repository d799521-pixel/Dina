// Référentiels de base : domaines du socle commun et matières usuelles.
// Les domaines de maternelle sont créés archivés et activés à l'installation
// si la classe comporte un niveau PS / MS / GS.

export const up = /* sql */ `
INSERT INTO socle_domains (code, label) VALUES
  ('D1.1', 'Comprendre, s''exprimer en utilisant la langue française'),
  ('D1.2', 'Comprendre, s''exprimer en utilisant une langue étrangère ou régionale'),
  ('D1.3', 'Comprendre, s''exprimer en utilisant les langages mathématiques, scientifiques et informatiques'),
  ('D1.4', 'Comprendre, s''exprimer en utilisant les langages des arts et du corps'),
  ('D2',   'Les méthodes et outils pour apprendre'),
  ('D3',   'La formation de la personne et du citoyen'),
  ('D4',   'Les systèmes naturels et les systèmes techniques'),
  ('D5',   'Les représentations du monde et l''activité humaine');

INSERT INTO subjects (name, short_name, color, icon, position, archived) VALUES
  ('Accueil / Rituels',          'Rituels',  '#64748b', 'sun',        0,  0),
  ('Français',                   'Français', '#2563eb', 'book-open',  10, 0),
  ('Mathématiques',              'Maths',    '#dc2626', 'calculator', 20, 0),
  ('Questionner le monde',       'QLM',      '#16a34a', 'globe',      30, 0),
  ('Histoire-Géographie',        'Hist-Géo', '#a16207', 'landmark',   31, 0),
  ('Sciences et technologie',    'Sciences', '#0d9488', 'flask',      32, 0),
  ('Langues vivantes',           'LVE',      '#7c3aed', 'languages',  40, 0),
  ('EPS',                        'EPS',      '#ea580c', 'dumbbell',   50, 0),
  ('Arts plastiques',            'Arts',     '#db2777', 'palette',    60, 0),
  ('Éducation musicale',         'Musique',  '#9333ea', 'music',      61, 0),
  ('Enseignement moral et civique', 'EMC',   '#0891b2', 'scale',      70, 0),
  ('Récréation',                 'Récré',    '#94a3b8', 'coffee',     90, 0),
  ('Mobiliser le langage dans toutes ses dimensions', 'Langage',   '#2563eb', 'message-circle', 100, 1),
  ('Agir, s''exprimer, comprendre à travers l''activité physique', 'Motricité', '#ea580c', 'dumbbell', 101, 1),
  ('Agir, s''exprimer, comprendre à travers les activités artistiques', 'Artistique', '#db2777', 'palette', 102, 1),
  ('Acquérir les premiers outils mathématiques', 'Outils maths', '#dc2626', 'shapes', 103, 1),
  ('Explorer le monde',          'Explorer', '#16a34a', 'globe',      104, 1),
  ('Apprendre ensemble et vivre ensemble', 'Vivre ensemble', '#0891b2', 'users', 105, 1);
`
