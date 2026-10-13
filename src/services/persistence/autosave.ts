import type { PageOverlays, PageRef, SourceMeta } from '../../types'

/**
 * Crash/reload recovery in IndexedDB (localStorage is limited to ~5 MB of strings;
 * IndexedDB stores binary PDFs natively and has quota in the GB range).
 *
 * Layout:
 *  - `sources`  one record per PDF file: bytes are written once, not on every edit
 *  - `session`  one small record with pages, overlays and metadata, rewritten on change
 */
const DB_NAME = 'pdf-studio'
const DB_VERSION = 1
const SESSION_STORE = 'session'
const SOURCE_STORE = 'sources'
const SESSION_KEY = 'current'
export const SESSION_SCHEMA_VERSION = 1

export type PersistedSession = {
    schemaVersion: number
    savedAt: number
    pages: PageRef[]
    overlays: PageOverlays
    sources: SourceMeta[]
    activePage: number
}

type SourceRecord = { key: string; bytes: Uint8Array }

export type RestoredSession = {
    session: PersistedSession
    bytes: Map<string, Uint8Array>
}

let dbPromise: Promise<IDBDatabase> | null = null

export const isPersistenceAvailable = (): boolean => typeof indexedDB !== 'undefined'

function openDb(): Promise<IDBDatabase> {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE)
            if (!db.objectStoreNames.contains(SOURCE_STORE)) db.createObjectStore(SOURCE_STORE, { keyPath: 'key' })
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => {
            dbPromise = null
            reject(request.error)
        }
    })
    return dbPromise
}

const promisify = <T>(request: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })

const transactionDone = (tx: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
    })

/**
 * Writes the session atomically together with any new source files and removes
 * sources no longer referenced. `getBytes` is only called for sources not yet stored.
 */
export async function saveSession(session: Omit<PersistedSession, 'schemaVersion' | 'savedAt'>, getBytes: (key: string) => Uint8Array): Promise<void> {
    const db = await openDb()
    const storedKeys = new Set((await promisify(db.transaction(SOURCE_STORE).objectStore(SOURCE_STORE).getAllKeys())).map(String))
    const wanted = new Set(session.sources.map((s) => s.key))

    const tx = db.transaction([SESSION_STORE, SOURCE_STORE], 'readwrite')
    const sources = tx.objectStore(SOURCE_STORE)
    for (const key of wanted) {
        if (!storedKeys.has(key)) sources.put({ key, bytes: getBytes(key) } satisfies SourceRecord)
    }
    for (const key of storedKeys) {
        if (!wanted.has(key)) sources.delete(key)
    }
    tx.objectStore(SESSION_STORE).put({ ...session, schemaVersion: SESSION_SCHEMA_VERSION, savedAt: Date.now() } satisfies PersistedSession, SESSION_KEY)
    await transactionDone(tx)
}

export async function loadSession(): Promise<RestoredSession | null> {
    const db = await openDb()
    const tx = db.transaction([SESSION_STORE, SOURCE_STORE])
    const session = (await promisify(tx.objectStore(SESSION_STORE).get(SESSION_KEY))) as PersistedSession | undefined
    if (!session || session.schemaVersion !== SESSION_SCHEMA_VERSION) return null

    const records = (await promisify(tx.objectStore(SOURCE_STORE).getAll())) as SourceRecord[]
    const bytes = new Map(records.map((r) => [r.key, r.bytes]))
    // A session whose files are missing (e.g. quota eviction) cannot be restored consistently.
    if (session.sources.some((s) => !bytes.has(s.key))) return null
    return { session, bytes }
}

export async function clearSession(): Promise<void> {
    const db = await openDb()
    const tx = db.transaction([SESSION_STORE, SOURCE_STORE], 'readwrite')
    tx.objectStore(SESSION_STORE).clear()
    tx.objectStore(SOURCE_STORE).clear()
    await transactionDone(tx)
}

/** Test seam: forget the cached connection (e.g. after replacing the IndexedDB implementation). */
export function resetPersistenceConnection(): void {
    dbPromise = null
}
