import { useState } from 'react'
import { Lock, ShieldCheck, WifiOff } from 'lucide-react'
import { LEVELS, WEEKDAY_LABELS } from '@shared/labels'
import type { DbStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { call } from '@/lib/api'
import { notifyError } from '@/lib/toast'
import { cn } from '@/lib/utils'

function schoolYear(): string {
  const d = new Date()
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-${y + 1}`
}

export function WelcomeScreen({ status, onReady }: { status: DbStatus; onReady: (s: DbStatus) => void }): React.JSX.Element {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-50 to-sky-50 p-6">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-xl">
        <h1 className="font-cursive text-4xl text-primary">Dina</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cahier journal, préparations et tableau de classe — vos données restent sur cet ordinateur.
        </p>
        {status.state === 'locked' ? <Unlock onReady={onReady} /> : <Setup onReady={onReady} />}
        <ul className="mt-8 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><WifiOff className="size-4" /> 100 % hors-ligne</li>
          <li className="flex items-center gap-2"><ShieldCheck className="size-4" /> Aucune télémétrie</li>
          <li className="flex items-center gap-2"><Lock className="size-4" /> Chiffrement AES-256</li>
        </ul>
      </div>
    </div>
  )
}

function Unlock({ onReady }: { onReady: (s: DbStatus) => void }): React.JSX.Element {
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      onReady(await call('db:unlock', pass))
    } catch (err) {
      notifyError(err)
      setPass('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <Field label="Mot de passe de la base">
        <Input type="password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy || !pass}>
        <Lock /> Déverrouiller
      </Button>
    </form>
  )
}

function Setup({ onReady }: { onReady: (s: DbStatus) => void }): React.JSX.Element {
  const [className, setClassName] = useState('')
  const [levels, setLevels] = useState<string[]>([])
  const [year, setYear] = useState(schoolYear())
  const [encrypt, setEncrypt] = useState(true)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [demo, setDemo] = useState(true)
  const [days, setDays] = useState<number[]>([1, 2, 4, 5])
  const [busy, setBusy] = useState(false)

  const passOk = !encrypt || (pass.length >= 8 && pass === pass2)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    try {
      onReady(
        await call('db:setup', {
          passphrase: encrypt ? pass : null,
          class_name: className,
          levels,
          school_year_label: year,
          demo,
          school_days: days
        })
      )
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom de la classe">
          <Input autoFocus required value={className} onChange={(e) => setClassName(e.target.value)} placeholder="CE1 — Mme Durand" />
        </Field>
        <Field label="Année scolaire">
          <Input value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground">Niveaux</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevels((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]))}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                levels.includes(l) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-medium text-muted-foreground">Jours où vous êtes en classe</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.slice(1, 7).map((label, i) => {
            const d = i + 1
            const on = days.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDays((ds) => (on ? ds.filter((x) => x !== d) : [...ds, d].sort()))}
                className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Alternant·e, temps partiel, complément de service : ne cochez que vos jours.</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
        Chiffrer la base avec un mot de passe (recommandé : fiches élèves, santé, contacts)
      </label>
      {encrypt && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mot de passe (8 caractères min.)">
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          <Field label="Confirmation">
            <Input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          </Field>
          <p className="col-span-2 text-xs text-amber-700">
            Sans ce mot de passe, les données sont irrécupérables : notez-le en lieu sûr.
          </p>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
        Ajouter un exemple (emploi du temps, séquence de mathématiques, rendez-vous)
      </label>
      <Button type="submit" size="lg" disabled={busy || !className.trim() || !passOk || days.length === 0}>
        Commencer
      </Button>
    </form>
  )
}
