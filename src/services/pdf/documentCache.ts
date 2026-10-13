import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { SourceKey } from '../../types'
import { normalizePdfJsError } from './errors'
import { getSource } from './sourceRegistry'

// Tests run pdf.js in Node with a file URL set up front (see src/test/setup.ts).
GlobalWorkerOptions.workerSrc ||= workerUrl

/**
 * One parsed pdf.js document per source, shared by the main view, thumbnails,
 * text extraction and search. Parsing a file is the most expensive pdf.js operation;
 * before this cache every page render re-parsed the complete file.
 *
 * The promise (not the resolved document) is cached so concurrent callers
 * share a single in-flight parse.
 */
const documents = new Map<SourceKey, Promise<PDFDocumentProxy>>()

export function getPdfDocument(key: SourceKey): Promise<PDFDocumentProxy> {
    const cached = documents.get(key)
    if (cached) return cached

    const { bytes, password } = getSource(key)
    const loading = getDocument({
        // pdf.js transfers the buffer to its worker, so it must get its own copy.
        data: bytes.slice(),
        password,
        // Keeps a strict Content-Security-Policy (no 'unsafe-eval') possible.
        isEvalSupported: false,
        verbosity: 0,
    }).promise.catch((error: unknown) => {
        documents.delete(key)
        throw normalizePdfJsError(error)
    })

    documents.set(key, loading)
    return loading
}

export const isPdfDocumentCached = (key: SourceKey): boolean => documents.has(key)

export async function evictPdfDocument(key: SourceKey): Promise<void> {
    const loading = documents.get(key)
    if (!loading) return
    documents.delete(key)
    try {
        const doc = await loading
        await doc.destroy()
    } catch {
        // A document that failed to load has nothing to release.
    }
}

export async function clearPdfDocuments(): Promise<void> {
    await Promise.all([...documents.keys()].map(evictPdfDocument))
}
