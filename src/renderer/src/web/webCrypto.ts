import {
  assertEnvelope,
  BACKUP_FORMAT,
  PBKDF2_ITERATIONS,
  type BackupEnvelope,
  type BackupPayload
} from '../../../main/services/backupCore'
import { ValidationError } from '../../../main/validation'

// Chiffrement avec l'API Web Crypto du navigateur : AES-256-GCM, clé dérivée
// du mot de passe par PBKDF2-SHA256 (même format que l'application de bureau).

const subtle = (): SubtleCrypto => globalThis.crypto.subtle

export const randomBytes = (n: number): Uint8Array<ArrayBuffer> => globalThis.crypto.getRandomValues(new Uint8Array(n))

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Chiffre ; le résultat contient le texte chiffré suivi de l'étiquette d'authentification (16 octets). */
export async function encrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<{ iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> }> {
  const iv = randomBytes(12)
  const out = await subtle().encrypt({ name: 'AES-GCM', iv }, key, data)
  return { iv, data: new Uint8Array(out) }
}

export async function decrypt(key: CryptoKey, iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, data))
}

async function pipe(data: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}
const gzip = (d: Uint8Array<ArrayBuffer>) => pipe(d, new CompressionStream('gzip'))
const gunzip = (d: Uint8Array<ArrayBuffer>) => pipe(d, new DecompressionStream('gzip'))

export async function createBackupWeb(payload: BackupPayload, passphrase: string | null): Promise<BackupEnvelope> {
  if (!passphrase) return { format: BACKUP_FORMAT, version: 1, encrypted: false, payload }
  const salt = randomBytes(16)
  const key = await deriveKey(passphrase, salt)
  const zipped = await gzip(new TextEncoder().encode(JSON.stringify(payload)))
  const { iv, data } = await encrypt(key, zipped)
  return {
    format: BACKUP_FORMAT,
    version: 1,
    encrypted: true,
    kdf: { name: 'pbkdf2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: 'aes-256-gcm',
    iv: toBase64(iv),
    tag: toBase64(data.subarray(data.length - 16)),
    data: toBase64(data.subarray(0, data.length - 16))
  }
}

export async function readBackupWeb(raw: unknown, passphrase: string | null): Promise<BackupPayload> {
  const env = assertEnvelope(raw)
  if (!env.encrypted) return env.payload
  if (!passphrase) throw new ValidationError('Cette sauvegarde est chiffrée : mot de passe requis')
  if (env.kdf.name !== 'pbkdf2') {
    throw new ValidationError('Sauvegarde d’une ancienne version de bureau : refaites-la depuis l’ordinateur.')
  }
  try {
    const key = await deriveKey(passphrase, fromBase64(env.kdf.salt), env.kdf.iterations)
    const cipherText = fromBase64(env.data)
    const tag = fromBase64(env.tag)
    const joined = new Uint8Array(cipherText.length + tag.length)
    joined.set(cipherText)
    joined.set(tag, cipherText.length)
    const zipped = await decrypt(key, fromBase64(env.iv), joined)
    return JSON.parse(new TextDecoder().decode(await gunzip(zipped))) as BackupPayload
  } catch {
    throw new ValidationError('Mot de passe incorrect ou sauvegarde corrompue')
  }
}
