import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, scryptSync } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { DB } from '../db/types'
import { ValidationError } from '../validation'
import {
  assertEnvelope,
  BACKUP_FORMAT,
  createPayload,
  PBKDF2_ITERATIONS,
  type BackupEnvelope,
  type BackupKdf,
  type BackupPayload
} from './backupCore'

export { restoreBackup } from './backupCore'
export type { BackupEnvelope }

function deriveKey(passphrase: string, kdf: BackupKdf): Buffer {
  const salt = Buffer.from(kdf.salt, 'base64')
  return kdf.name === 'pbkdf2'
    ? pbkdf2Sync(passphrase, salt, kdf.iterations, 32, 'sha256')
    : scryptSync(passphrase, salt, 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 64 * 1024 * 1024 })
}

export function createBackup(db: DB, passphrase: string | null): BackupEnvelope {
  const payload = createPayload(db)
  if (!passphrase) return { format: BACKUP_FORMAT, version: 1, encrypted: false, payload }

  const kdf: BackupKdf = { name: 'pbkdf2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: randomBytes(16).toString('base64') }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, kdf), iv)
  const data = Buffer.concat([cipher.update(gzipSync(JSON.stringify(payload))), cipher.final()])
  return {
    format: BACKUP_FORMAT,
    version: 1,
    encrypted: true,
    kdf,
    cipher: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  }
}

export function readBackup(raw: unknown, passphrase: string | null): BackupPayload {
  const env = assertEnvelope(raw)
  if (!env.encrypted) return env.payload
  if (!passphrase) throw new ValidationError('Cette sauvegarde est chiffrée : mot de passe requis')
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, env.kdf), Buffer.from(env.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(env.tag, 'base64'))
    const zipped = Buffer.concat([decipher.update(Buffer.from(env.data, 'base64')), decipher.final()])
    return JSON.parse(gunzipSync(zipped).toString('utf8')) as BackupPayload
  } catch {
    throw new ValidationError('Mot de passe incorrect ou sauvegarde corrompue')
  }
}
