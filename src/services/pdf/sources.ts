import type { SourceKey, SourceMeta } from '../../types'
import { clearPdfDocuments, evictPdfDocument, getPdfDocument } from './documentCache'
import { PdfError } from './errors'
import { hasEncryptDictionary, looksLikePdf } from './inspect'
import { clearSources, registerSource, removeSource } from './sourceRegistry'
import { clearTextCache } from './text'

/**
 * Lifecycle of a PDF source: register bytes, parse once (validates file and password),
 * and release every cache entry when the source is no longer needed.
 */
export async function openPdfSource(
    bytes: Uint8Array,
    name: string,
    options: { password?: string; key?: SourceKey } = {}
): Promise<SourceMeta> {
    if (!looksLikePdf(bytes)) throw new PdfError('invalid-pdf', 'Missing %PDF- header')

    const key = registerSource(bytes, options.password, options.key)
    try {
        const doc = await getPdfDocument(key)
        return {
            key,
            name,
            pageCount: doc.numPages,
            sizeBytes: bytes.byteLength,
            encrypted: hasEncryptDictionary(bytes),
        }
    } catch (error) {
        removeSource(key)
        throw error
    }
}

export async function releasePdfSource(key: SourceKey): Promise<void> {
    await evictPdfDocument(key)
    clearTextCache(key)
    removeSource(key)
}

export async function releaseAllPdfSources(): Promise<void> {
    await clearPdfDocuments()
    clearTextCache()
    clearSources()
}
