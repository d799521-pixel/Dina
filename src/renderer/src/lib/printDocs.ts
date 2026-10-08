// Documents HTML autonomes convertis en PDF par le processus principal.
// Aucun script, aucune ressource externe : polices système uniquement.

import { ACCOMMODATION_LABELS, AUTHORIZATION_LABELS, WORK_MODE_LABELS, APPOINTMENT_LABELS } from '@shared/labels'
import type { Lesson, SequenceListItem, StudentAppointment, StudentFile, StudentObservation, Subject } from '@shared/types'
import { today } from '@shared/date'
import { fmt } from './format'

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const para = (s: string): string => (s.trim() ? esc(s).replace(/\n/g, '<br>') : '<span class="empty">—</span>')

const shortDate = (d: string | null): string => (d ? d.split('-').reverse().join('/') : '—')

function page(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  .doc { font: 10.5pt/1.45 "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1f2937; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 2pt; }
  h2 { font-size: 11.5pt; margin: 14pt 0 5pt; padding-bottom: 2pt; border-bottom: 1.5pt solid #c7d2fe; color: #3730a3; }
  .meta { color: #6b7280; font-size: 9.5pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6pt 18pt; }
  .label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .03em; color: #6b7280; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9.5pt; }
  td, th { overflow-wrap: anywhere; }
  body { margin: 0; }
  th, td { border: .75pt solid #d1d5db; padding: 4pt 5pt; vertical-align: top; text-align: left; }
  th { background: #eef2ff; font-weight: 600; }
  .empty { color: #9ca3af; }
  .alert { border: 1.5pt solid #dc2626; background: #fef2f2; color: #991b1b; padding: 6pt 8pt; border-radius: 4pt; margin-top: 8pt; }
  .tag { display: inline-block; border: .75pt solid #a5b4fc; border-radius: 8pt; padding: 0 5pt; margin-right: 3pt; font-size: 9pt; }
  footer { margin-top: 18pt; font-size: 8pt; color: #9ca3af; }
</style></head><body><div class="doc">${body}</div></body></html>`
}

export function lessonDocument(lesson: Lesson, sequence: SequenceListItem | null, subject: Subject | undefined): string {
  const total = lesson.steps.reduce((sum, s) => sum + (s.duration_min ?? 0), 0)
  const field = (label: string, value: string): string => `<div><div class="label">${label}</div>${para(value)}</div>`
  return page(
    lesson.title,
    `<div class="meta">${esc(subject?.name ?? '')}${sequence ? ` · Séquence « ${esc(sequence.title)} »` : ''}${
      lesson.number_in_sequence ? ` · Séance ${lesson.number_in_sequence}` : ''
    }${sequence?.period_number ? ` · Période ${sequence.period_number}` : ''}</div>
    <h1>${esc(lesson.title)}</h1>
    <div class="meta">Durée : ${lesson.duration_min ?? total} min${total && lesson.duration_min && total !== lesson.duration_min ? ` (déroulement : ${total} min)` : ''}</div>
    <h2>Objectif</h2>${para(lesson.specific_objective)}
    <div class="grid" style="margin-top:8pt">${field('Matériel', lesson.materials)}${field('Critères de réussite', lesson.success_criteria)}</div>
    <h2>Déroulement</h2>
    <table><thead><tr><th style="width:4%">#</th><th style="width:20%">Phase</th><th style="width:8%">Durée</th><th style="width:11%">Modalité</th>
      <th>Rôle de l’enseignant</th><th>Activité des élèves</th><th style="width:14%">Matériel</th></tr></thead><tbody>
      ${lesson.steps
        .map(
          (s, i) => `<tr><td>${i + 1}</td><td><strong>${esc(s.title)}</strong></td><td>${s.duration_min ?? ''}${s.duration_min ? ' min' : ''}</td>
          <td>${esc(WORK_MODE_LABELS[s.work_mode])}</td><td>${para(s.teacher_role)}</td><td>${para(s.student_activity)}</td><td>${para(s.materials)}</td></tr>`
        )
        .join('') || '<tr><td colspan="7" class="empty">Aucune étape</td></tr>'}
    </tbody></table>
    <h2>Différenciation</h2>${para(lesson.differentiation)}
    <h2>Institutionnalisation / trace écrite</h2>${para(lesson.institutionalization)}
    <h2>Évaluation</h2>${para(lesson.assessment)}
    ${lesson.notes.trim() ? `<h2>Remarques</h2>${para(lesson.notes)}` : ''}`
  )
}

export function studentDocument(
  file: StudentFile,
  className: string,
  observations: StudentObservation[],
  appointments: StudentAppointment[]
): string {
  const yesNo = (v: 0 | 1): string => (v ? 'oui' : 'non')
  return page(
    `${file.first_name} ${file.last_name}`,
    `<div class="meta">${esc(className)} · Fiche de renseignements — document confidentiel</div>
    <h1>${esc(file.first_name)} ${esc(file.last_name.toUpperCase())}</h1>
    <div class="grid">
      <div><div class="label">Date de naissance</div>${shortDate(file.birth_date)}</div>
      <div><div class="label">Niveau</div>${esc(file.level) || '—'}</div>
      <div><div class="label">Arrivée</div>${shortDate(file.entry_date)}</div>
      <div><div class="label">Départ</div>${shortDate(file.leave_date)}</div>
    </div>
    ${
      file.health.has_pai || file.health.allergies.trim()
        ? `<div class="alert"><strong>${file.health.has_pai ? 'PAI' : 'Allergies'}</strong> — ${esc(file.health.allergies)}${
            file.health.pai_details ? `<br>${para(file.health.pai_details)}` : ''
          }</div>`
        : ''
    }
    <h2>Contacts</h2>
    <table><thead><tr><th>Nom</th><th>Lien</th><th>Téléphones</th><th>Courriel</th><th>Resp. légal</th><th>Urgence</th><th>Peut récupérer</th></tr></thead><tbody>
    ${file.contacts
      .map(
        (c) => `<tr><td>${esc(c.full_name)}${c.address ? `<br><span class="meta">${esc(c.address)}</span>` : ''}</td><td>${esc(c.relation)}</td>
        <td>${esc(c.phone)}${c.phone_alt ? `<br>${esc(c.phone_alt)}` : ''}</td><td>${esc(c.email)}</td>
        <td>${yesNo(c.is_legal_guardian)}</td><td>${yesNo(c.is_emergency)}</td><td>${yesNo(c.can_pick_up)}</td></tr>`
      )
      .join('') || '<tr><td colspan="7" class="empty">Aucun contact</td></tr>'}
    </tbody></table>
    <h2>Autorisations</h2>
    <table><thead><tr><th>Autorisation</th><th>Réponse</th><th>Signée le</th><th>Commentaire</th></tr></thead><tbody>
    ${file.authorizations
      .map(
        (a) => `<tr><td>${esc(AUTHORIZATION_LABELS[a.kind] ?? a.kind)}</td><td>${a.granted ? 'Accordée' : '<strong>Refusée</strong>'}</td>
        <td>${shortDate(a.signed_on)}</td><td>${esc(a.comment)}</td></tr>`
      )
      .join('') || '<tr><td colspan="4" class="empty">Non renseignées</td></tr>'}
    </tbody></table>
    <h2>Santé</h2>
    <div class="grid"><div><div class="label">Allergies</div>${para(file.health.allergies)}</div><div><div class="label">PAI</div>${
      file.health.has_pai ? para(file.health.pai_details || 'oui') : 'non'
    }</div></div>
    <div style="margin-top:6pt"><div class="label">Informations médicales</div>${para(file.health.medical_notes)}</div>
    <h2>Aménagements pédagogiques</h2>
    ${
      file.accommodations
        .map(
          (a) => `<p><span class="tag">${esc(ACCOMMODATION_LABELS[a.type])}</span> ${shortDate(a.start_date)} → ${shortDate(a.end_date)}<br>${para(a.details)}</p>`
        )
        .join('') || '<p class="empty">Aucun</p>'
    }
    ${
      observations.length
        ? `<h2>Observations</h2><table><thead><tr><th style="width:15%">Date</th><th style="width:18%">Domaine</th><th>Observation</th></tr></thead><tbody>
      ${observations.map((o) => `<tr><td>${shortDate(o.date)}</td><td>${esc(o.category)}</td><td>${para(o.content)}</td></tr>`).join('')}</tbody></table>`
        : ''
    }
    ${
      appointments.length
        ? `<h2>Rendez-vous</h2><table><thead><tr><th style="width:15%">Date</th><th style="width:18%">Type</th><th>Objet / compte rendu</th></tr></thead><tbody>
      ${appointments
        .map((a) => `<tr><td>${shortDate(a.date)}</td><td>${esc(APPOINTMENT_LABELS[a.kind])}</td><td><strong>${esc(a.title)}</strong>${a.report ? `<br>${para(a.report)}` : ''}</td></tr>`)
        .join('')}</tbody></table>`
        : ''
    }
    <footer>Édité le ${esc(fmt(today(), 'd MMMM yyyy'))} avec Dina — données conservées localement sur le poste de l’enseignant·e. Ne pas diffuser.</footer>`
  )
}
