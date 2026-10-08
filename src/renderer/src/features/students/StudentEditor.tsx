import { useEffect, useState } from 'react'
import { FileDown, FileJson, HeartPulse, Plus, Save, Trash2, UserX, X } from 'lucide-react'
import { today } from '@shared/date'
import { ACCOMMODATION_LABELS, APPOINTMENT_LABELS, AUTHORIZATION_LABELS, LEVELS, OBSERVATION_CATEGORIES } from '@shared/labels'
import {
  ACCOMMODATION_TYPES,
  type AccommodationType,
  type StudentAppointment,
  type StudentContact,
  type StudentFile,
  type StudentObservation
} from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { call, tryCall } from '@/lib/api'
import { fmt } from '@/lib/format'
import { studentDocument } from '@/lib/printDocs'
import { notify, notifyError } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Tab = 'identite' | 'autorisations' | 'sante' | 'suivi'

const EMPTY: StudentFile = {
  id: null,
  last_name: '',
  first_name: '',
  birth_date: null,
  level: '',
  entry_date: null,
  leave_date: null,
  contacts: [],
  authorizations: [],
  health: { allergies: '', has_pai: 0, pai_details: '', medical_notes: '' },
  accommodations: []
}

const emptyContact = (): StudentContact => ({
  full_name: '',
  relation: '',
  phone: '',
  phone_alt: '',
  email: '',
  address: '',
  is_legal_guardian: 1,
  is_emergency: 1,
  can_pick_up: 1
})

export function StudentEditor({
  studentId,
  className,
  onSaved,
  onErased
}: {
  studentId: number | 'new'
  className: string
  onSaved: (id: number) => void
  onErased: () => void
}): React.JSX.Element | null {
  const [form, setForm] = useState<StudentFile | null>(studentId === 'new' ? EMPTY : null)
  const [saved, setSaved] = useState(JSON.stringify(EMPTY))
  const [tab, setTab] = useState<Tab>('identite')
  const [erasing, setErasing] = useState(false)

  useEffect(() => {
    if (studentId === 'new') return
    void tryCall('students:get', studentId).then((f) => {
      if (!f) return
      setForm(f)
      setSaved(JSON.stringify(f))
    })
  }, [studentId])

  if (!form) return null
  const dirty = JSON.stringify(form) !== saved
  const set = <K extends keyof StudentFile>(k: K, v: StudentFile[K]): void => setForm((f) => f && { ...f, [k]: v })
  const isNew = form.id === null

  const save = async (): Promise<StudentFile | undefined> => {
    try {
      const f = await call('students:save', form)
      setForm(f)
      setSaved(JSON.stringify(f))
      notify('Fiche enregistrée.')
      onSaved(f.id!)
      return f
    } catch (err) {
      notifyError(err)
      return undefined
    }
  }

  const exportPdf = async (): Promise<void> => {
    const f = dirty ? await save() : form
    if (!f?.id) return
    try {
      const [obs, appts] = await Promise.all([call('students:observations', f.id), call('students:appointments', f.id)])
      const path = await call('pdf:export', studentDocument(f, className, obs, appts), `${f.last_name} ${f.first_name}.pdf`)
      if (path) notify(`PDF enregistré : ${path}`)
    } catch (err) {
      notifyError(err)
    }
  }

  const exportJson = async (): Promise<void> => {
    if (!form.id) return
    const path = await tryCall('students:export', form.id)
    if (path) notify(`Données exportées : ${path}`)
  }

  const alertHealth = form.health.has_pai === 1 || form.health.allergies.trim() !== ''

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">
            {isNew && !form.first_name ? 'Nouvel élève' : `${form.first_name} ${form.last_name}`}
          </h2>
          {form.leave_date && <span className="text-xs text-muted-foreground">Parti·e le {fmt(form.leave_date, 'd MMMM yyyy')}</span>}
        </div>
        {!isNew && (
          <>
            <Button variant="ghost" className="text-destructive" onClick={() => setErasing(true)} title="Droit à l’effacement (RGPD)">
              <UserX /> Effacer
            </Button>
            <Button variant="outline" onClick={exportJson} title="Droit d’accès / portabilité : toutes les données en JSON">
              <FileJson /> JSON
            </Button>
            <Button variant="outline" onClick={exportPdf}>
              <FileDown /> PDF
            </Button>
          </>
        )}
        <Button onClick={save} disabled={!dirty || !form.first_name.trim() || !form.last_name.trim()}>
          <Save /> Enregistrer
        </Button>
      </div>

      {alertHealth && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <HeartPulse className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>{form.health.has_pai ? 'PAI' : 'Allergie'}</strong>
            {form.health.allergies && ` — ${form.health.allergies}`}
            {form.health.pai_details && <div className="text-red-800">{form.health.pai_details}</div>}
          </div>
        </div>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'identite', label: 'Identité & contacts' },
          { value: 'autorisations', label: 'Autorisations' },
          { value: 'sante', label: 'Santé & aménagements' },
          { value: 'suivi', label: 'Suivi', title: isNew ? 'Enregistrez d’abord la fiche' : undefined }
        ]}
      />

      {tab === 'identite' && (
        <>
          <div className="grid grid-cols-6 gap-4 rounded-xl border bg-card p-5">
            <Field label="Prénom" className="col-span-2">
              <Input autoFocus={isNew} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
            </Field>
            <Field label="Nom" className="col-span-2">
              <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
            </Field>
            <Field label="Niveau" className="col-span-2">
              <Select value={form.level} onChange={(e) => set('level', e.target.value)}>
                <option value="">—</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date de naissance" className="col-span-2">
              <Input type="date" value={form.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value || null)} />
            </Field>
            <Field label="Arrivée dans la classe" className="col-span-2">
              <Input type="date" value={form.entry_date ?? ''} onChange={(e) => set('entry_date', e.target.value || null)} />
            </Field>
            <Field label="Départ (radiation)" className="col-span-2">
              <Input type="date" value={form.leave_date ?? ''} onChange={(e) => set('leave_date', e.target.value || null)} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Contacts</h3>
              <Button variant="outline" size="sm" onClick={() => set('contacts', [...form.contacts, emptyContact()])}>
                <Plus /> Ajouter un contact
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.contacts.map((c, i) => {
                const upd = (patch: Partial<StudentContact>): void =>
                  set('contacts', form.contacts.map((x, j) => (j === i ? { ...x, ...patch } : x)))
                return (
                  <div key={i} className="grid grid-cols-6 gap-2 rounded-xl border bg-card p-3">
                    <Input className="col-span-2" value={c.full_name} onChange={(e) => upd({ full_name: e.target.value })} placeholder="Nom complet" />
                    <Input className="col-span-1" value={c.relation} onChange={(e) => upd({ relation: e.target.value })} placeholder="Lien" />
                    <Input className="col-span-1" type="tel" value={c.phone} onChange={(e) => upd({ phone: e.target.value })} placeholder="Téléphone" />
                    <Input className="col-span-1" type="tel" value={c.phone_alt} onChange={(e) => upd({ phone_alt: e.target.value })} placeholder="Autre tél." />
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => set('contacts', form.contacts.filter((_, j) => j !== i))} aria-label="Retirer le contact">
                        <X />
                      </Button>
                    </div>
                    <Input className="col-span-2" type="email" value={c.email} onChange={(e) => upd({ email: e.target.value })} placeholder="Courriel" />
                    <Input className="col-span-2" value={c.address} onChange={(e) => upd({ address: e.target.value })} placeholder="Adresse" />
                    <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {(
                        [
                          ['is_legal_guardian', 'Resp. légal'],
                          ['is_emergency', 'Urgence'],
                          ['can_pick_up', 'Peut récupérer']
                        ] as const
                      ).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-1">
                          <input type="checkbox" checked={c[k] === 1} onChange={(e) => upd({ [k]: e.target.checked ? 1 : 0 })} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
              {form.contacts.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucun contact enregistré.</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'autorisations' && (
        <div className="flex flex-col divide-y rounded-xl border bg-card">
          {Object.entries(AUTHORIZATION_LABELS).map(([kind, label]) => {
            const a = form.authorizations.find((x) => x.kind === kind)
            const setAuth = (patch: Partial<{ granted: 0 | 1; signed_on: string | null; comment: string }> | null): void =>
              set(
                'authorizations',
                patch === null
                  ? form.authorizations.filter((x) => x.kind !== kind)
                  : a
                    ? form.authorizations.map((x) => (x.kind === kind ? { ...x, ...patch } : x))
                    : [...form.authorizations, { kind, granted: 1, signed_on: today(), comment: '', ...patch }]
              )
            return (
              <div key={kind} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-64 text-sm font-medium">{label}</span>
                <Segmented<'?' | 'oui' | 'non'>
                  value={!a ? '?' : a.granted ? 'oui' : 'non'}
                  onChange={(v) => setAuth(v === '?' ? null : { granted: v === 'oui' ? 1 : 0 })}
                  options={[
                    { value: '?', label: 'Non renseigné' },
                    { value: 'oui', label: 'Accordée' },
                    { value: 'non', label: 'Refusée' }
                  ]}
                />
                {a && (
                  <>
                    <Input type="date" className="w-40" value={a.signed_on ?? ''} onChange={(e) => setAuth({ signed_on: e.target.value || null })} aria-label="Signée le" />
                    <Input className="min-w-40 flex-1" value={a.comment} onChange={(e) => setAuth({ comment: e.target.value })} placeholder="Commentaire" />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'sante' && (
        <>
          <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5">
            <Field label="Allergies / intolérances">
              <Input value={form.health.allergies} onChange={(e) => set('health', { ...form.health, allergies: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={form.health.has_pai === 1} onChange={(e) => set('health', { ...form.health, has_pai: e.target.checked ? 1 : 0 })} />
              Projet d’accueil individualisé (PAI)
            </label>
            {form.health.has_pai === 1 && (
              <Field label="PAI : protocole, trousse d’urgence, médecin" className="col-span-2">
                <Textarea value={form.health.pai_details} onChange={(e) => set('health', { ...form.health, pai_details: e.target.value })} />
              </Field>
            )}
            <Field label="Autres informations médicales utiles à l’école" className="col-span-2">
              <Textarea className="min-h-14" value={form.health.medical_notes} onChange={(e) => set('health', { ...form.health, medical_notes: e.target.value })} />
            </Field>
            <p className="col-span-2 text-xs text-muted-foreground">
              Données de santé : ne saisir que ce qui est nécessaire à la sécurité de l’élève (RGPD, art. 9).
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase">Aménagements pédagogiques</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => set('accommodations', [...form.accommodations, { type: 'PAP', start_date: today(), end_date: null, details: '' }])}
              >
                <Plus /> Ajouter
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.accommodations.map((a, i) => {
                const upd = (patch: Partial<typeof a>): void =>
                  set('accommodations', form.accommodations.map((x, j) => (j === i ? { ...x, ...patch } : x)))
                return (
                  <div key={i} className="grid grid-cols-6 gap-2 rounded-xl border bg-card p-3">
                    <Select className="col-span-2" value={a.type} onChange={(e) => upd({ type: e.target.value as AccommodationType })}>
                      {ACCOMMODATION_TYPES.map((t) => (
                        <option key={t} value={t}>{ACCOMMODATION_LABELS[t]}</option>
                      ))}
                    </Select>
                    <Input className="col-span-2" type="date" value={a.start_date ?? ''} onChange={(e) => upd({ start_date: e.target.value || null })} aria-label="Début" />
                    <Input className="col-span-1" type="date" value={a.end_date ?? ''} onChange={(e) => upd({ end_date: e.target.value || null })} aria-label="Fin" />
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => set('accommodations', form.accommodations.filter((_, j) => j !== i))} aria-label="Retirer">
                        <X />
                      </Button>
                    </div>
                    <Textarea
                      className="col-span-6 min-h-14"
                      value={a.details}
                      onChange={(e) => upd({ details: e.target.value })}
                      placeholder="Adaptations : tiers-temps, supports agrandis, AESH, outils…"
                    />
                  </div>
                )
              })}
              {form.accommodations.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucun aménagement.</p>}
            </div>
          </div>
        </>
      )}

      {tab === 'suivi' &&
        (form.id ? <FollowUp studentId={form.id} /> : <p className="text-sm text-muted-foreground">Enregistrez la fiche pour commencer le suivi.</p>)}

      {erasing && form.id && (
        <EraseDialog
          name={form.first_name}
          onClose={() => setErasing(false)}
          onConfirm={async () => {
            if ((await tryCall('students:erase', form.id!)) !== undefined) {
              notify('Toutes les données de l’élève ont été effacées.')
              onErased()
            }
          }}
        />
      )}
    </div>
  )
}

function FollowUp({ studentId }: { studentId: number }): React.JSX.Element {
  const [observations, setObservations] = useState<StudentObservation[]>([])
  const [appointments, setAppointments] = useState<StudentAppointment[]>([])
  const [draft, setDraft] = useState({ date: today(), category: OBSERVATION_CATEGORIES[0], content: '' })

  useEffect(() => {
    void tryCall('students:observations', studentId).then((o) => o && setObservations(o))
    void tryCall('students:appointments', studentId).then((a) => a && setAppointments(a))
  }, [studentId])

  const add = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const o = await tryCall('students:add-observation', studentId, draft)
    if (o) {
      setObservations((list) => [o, ...list].sort((a, b) => b.date.localeCompare(a.date)))
      setDraft((d) => ({ ...d, content: '' }))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex flex-col gap-3">
        <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
          <div className="flex gap-2">
            <Input type="date" className="w-40" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <Select className="w-44" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {OBSERVATION_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <Textarea className="min-h-14" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Observation factuelle (réussite, difficulté, comportement…)" />
          <Button type="submit" size="sm" className="self-end" disabled={!draft.content.trim()}>
            <Plus /> Ajouter l’observation
          </Button>
        </form>
        <ul className="flex flex-col gap-2">
          {observations.map((o) => (
            <li key={o.id} className="group rounded-lg border bg-card px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {fmt(o.date, 'EEE d MMM yyyy')} <Badge className="py-0">{o.category}</Badge>
                <button
                  className="ml-auto opacity-0 group-hover:opacity-100"
                  onClick={async () => {
                    await tryCall('students:delete-observation', o.id)
                    setObservations((l) => l.filter((x) => x.id !== o.id))
                  }}
                  aria-label="Supprimer l’observation"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{o.content}</p>
            </li>
          ))}
          {observations.length === 0 && <li className="text-sm text-muted-foreground">Aucune observation.</li>}
        </ul>
      </div>
      <aside>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase">Rendez-vous</h3>
        <ul className="flex flex-col gap-2">
          {appointments.map((a) => (
            <li key={a.id} className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
              <div className="text-xs text-violet-800">
                {fmt(a.date, 'd MMM yyyy')} · {APPOINTMENT_LABELS[a.kind]}
              </div>
              <div className="font-medium">{a.title}</div>
              {a.report && <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{a.report}</p>}
            </li>
          ))}
          {appointments.length === 0 && (
            <li className="text-sm text-muted-foreground">Aucun. Associez l’élève à un rendez-vous depuis le cahier journal.</li>
          )}
        </ul>
      </aside>
    </div>
  )
}

function EraseDialog({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }): React.JSX.Element {
  const [typed, setTyped] = useState('')
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Effacer définitivement cet élève ?"
      description="Fiche, contacts, santé, aménagements, autorisations et observations seront supprimés de façon irréversible (droit à l’effacement). Pensez à exporter les données si la famille les demande."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={typed.trim() !== name.trim()} onClick={onConfirm}>
            <Trash2 /> Effacer
          </Button>
        </>
      }
    >
      <Field label={`Pour confirmer, tapez le prénom : ${name}`}>
        <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className={cn(typed && typed !== name && 'border-destructive')} />
      </Field>
    </Dialog>
  )
}
