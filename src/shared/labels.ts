import type { AppointmentKind, SlotNoteKind, SlotStatus, WorkMode } from './types'

export const STATUS_LABELS: Record<SlotStatus, string> = {
  prevu: 'Prévu',
  fait: 'Fait',
  partiel: 'Partiellement fait',
  reporte: 'Reporté',
  annule: 'Annulé'
}

export const NOTE_KIND_LABELS: Record<SlotNoteKind, string> = {
  retard: 'Retard',
  imprevu: 'Imprévu',
  differenciation: 'Différenciation',
  comportement: 'Comportement',
  reussite: 'Réussite',
  autre: 'Remarque'
}

export const APPOINTMENT_LABELS: Record<AppointmentKind, string> = {
  parents: 'Parents',
  rased: 'RASED',
  equipe: 'Équipe / conseil des maîtres',
  ess: 'ESS',
  conseil: "Conseil d'école",
  autre: 'Autre'
}

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  individuel: 'Individuel',
  binome: 'Binôme',
  groupe: 'Groupes',
  collectif: 'Collectif'
}

export const WEEKDAY_LABELS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const LEVELS = ['TPS', 'PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'ULIS']
