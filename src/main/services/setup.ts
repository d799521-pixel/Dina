import { addDays, startOfWeek, today } from '@shared/date'
import type { SetupInput } from '@shared/types'
import type { DB } from '../db/connection'
import { createClassWithYear } from '../repositories/classes'
import { applyTimetableToWeek } from '../repositories/timetable'
import { getAppSettings } from '../repositories/settings'
import { ValidationError } from '../validation'

export function initialSetup(db: DB, input: SetupInput): void {
  const name = input.class_name.trim()
  if (!name) throw new ValidationError('Le nom de la classe est obligatoire')
  const cls = createClassWithYear(db, input.school_year_label.trim() || 'Année en cours', name, input.levels)
  if (input.demo) seedDemo(db, cls.id)
}

/** Données fictives pour découvrir l'application (aucun élève réel). */
export function seedDemo(db: DB, classId: number): void {
  const subject = (short: string): number =>
    (db.prepare('SELECT id FROM subjects WHERE short_name = ?').get(short) as { id: number }).id

  db.transaction(() => {
    const period = db.prepare('SELECT id FROM periods ORDER BY id LIMIT 1').get() as { id: number }
    const seq = Number(
      db
        .prepare(
          `INSERT INTO sequences (class_id, subject_id, period_id, title, socle_domain, general_objectives,
                                  prerequisites, planned_sessions_count, success_criteria)
           VALUES (?, ?, ?, ?, 'D1.3', ?, ?, 3, ?)`
        )
        .run(
          classId,
          subject('Maths'),
          period.id,
          'Additionner avec retenue',
          'Comprendre et utiliser la technique opératoire de l’addition posée avec retenue.',
          'Numération jusqu’à 1 000 ; addition sans retenue.',
          'Je pose correctement l’opération ; je n’oublie pas la retenue.'
        ).lastInsertRowid
    )
    const lessonInsert = db.prepare(
      `INSERT INTO lessons (class_id, sequence_id, subject_id, number_in_sequence, title, specific_objective,
                            duration_min, materials, differentiation, institutionalization)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const titles = [
      ['Découvrir la retenue avec le matériel', 'Échanger 10 unités contre 1 dizaine.'],
      ['Poser l’addition en colonnes', 'Aligner unités, dizaines, centaines.'],
      ['S’entraîner et s’auto-corriger', 'Calculer des additions posées avec retenue.']
    ]
    titles.forEach(([title, obj], i) => {
      const lessonId = Number(
        lessonInsert.run(
          classId, seq, subject('Maths'), i + 1, title, obj, 45,
          'Cubes base 10, ardoises, affiche collective',
          'Groupe de besoin avec le matériel ; défis pour les plus rapides.',
          'Trace écrite : « Quand j’ai 10 unités ou plus, je fais une retenue. »'
        ).lastInsertRowid
      )
      const step = db.prepare(
        `INSERT INTO lesson_steps (lesson_id, position, title, duration_min, work_mode, teacher_role, student_activity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      step.run(lessonId, 1, 'Rappel / mise en situation', 10, 'collectif', 'Questionne, relance.', 'Répondent sur ardoise.')
      step.run(lessonId, 2, 'Recherche', 15, 'binome', 'Observe, aide les binômes.', 'Manipulent et cherchent.')
      step.run(lessonId, 3, 'Mise en commun et trace écrite', 20, 'collectif', 'Institutionnalise.', 'Copient la trace écrite.')
    })

    const tt = Number(
      db.prepare('INSERT INTO timetable_templates (class_id, name) VALUES (?, ?)').run(classId, 'Emploi du temps')
        .lastInsertRowid
    )
    const ttInsert = db.prepare(
      'INSERT INTO timetable_slots (template_id, weekday, start_time, end_time, subject_id, label) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const day of [1, 2, 4, 5]) {
      ttInsert.run(tt, day, '08:30', '08:50', subject('Rituels'), 'Accueil, date, météo')
      ttInsert.run(tt, day, '08:50', '10:00', subject('Français'), day % 2 ? 'Lecture' : 'Étude de la langue')
      ttInsert.run(tt, day, '10:00', '10:15', subject('Récré'), 'Récréation')
      ttInsert.run(tt, day, '10:15', '11:30', subject('Maths'), 'Calcul / numération')
      ttInsert.run(tt, day, '13:30', '14:30', subject(day === 2 || day === 5 ? 'EPS' : 'QLM'), '')
      ttInsert.run(tt, day, '14:30', '15:30', subject(day === 1 ? 'Arts' : day === 4 ? 'Musique' : 'LVE'), '')
      ttInsert.run(tt, day, '15:45', '16:30', subject('Français'), 'Production d’écrits')
    }

    const week = startOfWeek(today())
    applyTimetableToWeek(db, classId, week, getAppSettings(db).school_days)
    db.prepare(
      `INSERT INTO appointments (class_id, date, start_time, end_time, kind, title, location)
       VALUES (?, ?, '16:45', '17:30', 'parents', 'Rencontre avec une famille', 'Salle de classe'),
              (?, ?, '17:00', '18:00', 'equipe', 'Conseil des maîtres', 'Salle des maîtres')`
    ).run(classId, addDays(week, 1), classId, addDays(week, 3))
  })()
}
