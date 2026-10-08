import { useEffect, useState } from 'react'
import { Download, FileInput, KeyRound, Lock, Save, Upload } from 'lucide-react'
import { LEVELS, WEEKDAY_LABELS } from '@shared/labels'
import type { AppSettings, DbStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { call, tryCall } from '@/lib/api'
import { notify, notifyError } from '@/lib/toast'
import { applyTemplate } from '@/lib/templates'
import { cn } from '@/lib/utils'
import { pickFile } from '@/web/files'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SettingsPage({ status, onStatusChange }: { status: DbStatus; onStatusChange: (s: DbStatus) => void }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>()
  const [newPass, setNewPass] = useState('')
  const [backupPass, setBackupPass] = useState('')
  const [className, setClassName] = useState(status.current_class?.name ?? '')
  const [levels, setLevels] = useState<string[]>(status.current_class?.levels ?? [])

  const saveClass = async (): Promise<void> => {
    try {
      await call('class:update', className, levels)
      onStatusChange(await call('db:status'))
      notify('Classe mise à jour.')
    } catch (err) {
      notifyError(err)
    }
  }

  const importTemplate = async (): Promise<void> => {
    const file = await pickFile('.json,application/json')
    if (!file) return
    try {
      const raw = JSON.parse(await file.text()) as { timetable?: unknown[] }
      const replace = Boolean(raw.timetable?.length) &&
        window.confirm('Ce modèle contient un emploi du temps type : remplacer l’emploi du temps type actuel ?')
      notify(await applyTemplate(raw, replace))
      setSettings(await call('settings:get'))
    } catch (err) {
      notifyError(err)
    }
  }

  useEffect(() => {
    void tryCall('settings:get').then(setSettings)
  }, [])

  const save = async (patch: Partial<AppSettings>): Promise<void> => {
    const next = await tryCall('settings:update', patch)
    if (next) setSettings(next)
  }

  const changePass = async (remove: boolean): Promise<void> => {
    if (remove && !window.confirm('Retirer le chiffrement ? Les données seront lisibles par toute personne ayant accès au fichier.')) return
    try {
      onStatusChange(await call('db:change-passphrase', remove ? null : newPass))
      setNewPass('')
      notify(remove ? 'Chiffrement retiré.' : 'Mot de passe mis à jour.')
    } catch (err) {
      notifyError(err)
    }
  }

  const exportBackup = async (): Promise<void> => {
    const path = await tryCall('backup:export', backupPass || null)
    if (path) notify(`Sauvegarde enregistrée : ${path}`)
  }

  const importBackup = async (): Promise<void> => {
    if (!window.confirm('La restauration remplace toutes les données actuelles. Continuer ?')) return
    if (await tryCall('backup:import', backupPass || null)) {
      notify('Sauvegarde restaurée.')
      onStatusChange(await call('db:status'))
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 p-8">
        <h1 className="text-2xl font-semibold">Paramètres</h1>

        <Section title="Classe">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Nom de la classe" className="w-72">
              <Input value={className} onChange={(e) => setClassName(e.target.value)} />
            </Field>
            <Button onClick={saveClass} disabled={!className.trim()}>
              <Save /> Enregistrer
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevels((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]))}
                className={cn('rounded-full border px-3 py-1 text-xs', levels.includes(l) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Avec un niveau de maternelle, les domaines du programme 2024-2026 et les temps propres à la maternelle (regroupement, sieste…) sont proposés.</p>
        </Section>

        <Section
          title="Importer un modèle"
          description="Fichier .json préparé pour Dina : emploi du temps type, progressions d’un manuel, jours de classe."
        >
          <Button variant="outline" onClick={importTemplate}>
            <FileInput /> Choisir un fichier modèle
          </Button>
        </Section>

        {settings && (
          <Section title="Semaine de classe">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const on = settings.school_days.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => save({ school_days: on ? settings.school_days.filter((x) => x !== d) : [...settings.school_days, d] })}
                    className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
                  >
                    {WEEKDAY_LABELS[d]}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 grid max-w-sm grid-cols-2 gap-4">
              <Field label="Début de journée">
                <Input type="time" value={settings.day_start} onChange={(e) => save({ day_start: e.target.value })} />
              </Field>
              <Field label="Fin de journée">
                <Input type="time" value={settings.day_end} onChange={(e) => save({ day_end: e.target.value })} />
              </Field>
            </div>
          </Section>
        )}

        <Section
          title="Sécurité"
          description={
            status.encrypted
              ? 'La base est chiffrée (SQLCipher, AES-256). Le mot de passe est demandé à chaque ouverture.'
              : 'La base n’est pas chiffrée. Recommandé si l’ordinateur est partagé ou transporté.'
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label={status.encrypted ? 'Nouveau mot de passe' : 'Mot de passe (8 caractères min.)'} className="w-64">
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </Field>
            <Button onClick={() => changePass(false)} disabled={newPass.length < 8}>
              <KeyRound /> {status.encrypted ? 'Changer' : 'Chiffrer la base'}
            </Button>
            {status.encrypted && (
              <>
                <Button variant="ghost" onClick={() => changePass(true)}>
                  Retirer le chiffrement
                </Button>
                <Button variant="outline" className="ml-auto" onClick={async () => onStatusChange(await call('db:lock'))}>
                  <Lock /> Verrouiller
                </Button>
              </>
            )}
          </div>
        </Section>

        <Section
          title="Sauvegarde et restauration"
          description="Fichier JSON compressé, chiffré en AES-256-GCM si un mot de passe est saisi. À conserver sur une clé USB ou un disque externe."
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Mot de passe de la sauvegarde (facultatif)" className="w-72">
              <Input type="password" value={backupPass} onChange={(e) => setBackupPass(e.target.value)} />
            </Field>
            <Button variant="outline" onClick={exportBackup}>
              <Download /> Exporter
            </Button>
            <Button variant="outline" onClick={importBackup}>
              <Upload /> Restaurer
            </Button>
          </div>
        </Section>

        <Section title="Confidentialité">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {window.dina.platform === 'web' ? (
              <>
                <li>Une fois ouverte, Dina fonctionne sans Internet. Aucune donnée n’est envoyée : tout reste sur cet appareil.</li>
                <li>Aucune télémétrie, aucun compte, aucun cookie publicitaire.</li>
                <li className="font-medium text-amber-700">
                  Supprimer l’icône Dina de l’écran d’accueil ou effacer les données de Safari efface aussi la base :
                  exportez une sauvegarde régulièrement (elle arrive dans l’app Fichiers).
                </li>
              </>
            ) : (
              <>
                <li>Aucune connexion Internet : toute requête réseau est bloquée par l’application.</li>
                <li>Aucune télémétrie, aucun rapport de plantage, aucune mise à jour automatique.</li>
                <li>Polices, icônes et scripts sont embarqués localement.</li>
              </>
            )}
            <li>
              Données : <code className="text-xs break-all">{status.path}</code>
            </li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
