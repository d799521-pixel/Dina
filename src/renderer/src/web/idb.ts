// Petit magasin clé/valeur IndexedDB (stockage local de l'iPad, jamais envoyé).

const DB_NAME = 'dina'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => {
      db.close()
      resolve(req ? req.result : undefined)
    }
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export const idbGet = <T>(key: string): Promise<T | undefined> => tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>)
export const idbSet = (key: string, value: unknown): Promise<unknown> => tx('readwrite', (s) => s.put(value, key))
export const idbDelete = (key: string): Promise<unknown> => tx('readwrite', (s) => s.delete(key))
