import type { SourceKey } from '../../types'
import { PdfError } from './errors'

/**
 * Holds the raw bytes of every loaded PDF file, keyed by a stable source key.
 *
 * Binary data deliberately lives outside the Zustand store:
 *  - undo/redo snapshots only copy small page references, never megabytes of PDF data,
 *  - store updates stay cheap (Immer never walks the buffers),
 *  - passwords never end up in persisted or serialized state.
 */
type SourceEntry = {
    bytes: Uint8Array
    password?: string
}

const sources = new Map<SourceKey, SourceEntry>()

const createKey = (): SourceKey =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function registerSource(bytes: Uint8Array, password?: string, key: SourceKey = createKey()): SourceKey {
    sources.set(key, { bytes, password })
    return key
}

export function getSource(key: SourceKey): SourceEntry {
    const entry = sources.get(key)
    if (!entry) throw new PdfError('source-missing', `Unknown PDF source: ${key}`)
    return entry
}

export const hasSource = (key: SourceKey): boolean => sources.has(key)

export const removeSource = (key: SourceKey): boolean => sources.delete(key)

export const listSourceKeys = (): SourceKey[] => [...sources.keys()]

export function clearSources(): void {
    sources.clear()
}
