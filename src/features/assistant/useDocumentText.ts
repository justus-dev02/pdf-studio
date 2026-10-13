import { useEffect, useState } from 'react'
import { useDoc } from '../../store'
import { extractDocumentText, isCancelled } from '../../services/pdf'
import type { DocumentPageText } from '../../services/pdf'

export type DocumentTextState =
    | { status: 'idle' | 'empty-document' }
    | { status: 'loading'; done: number; total: number }
    | { status: 'ready'; pages: DocumentPageText[]; hasText: boolean }
    | { status: 'error'; error: unknown }

/**
 * Plain text of all pages for the assistant tabs. Extraction is cached per page by the
 * PDF service, so switching tabs or re-opening the assistant is instant after the first run.
 */
export function useDocumentText(): DocumentTextState {
    const pages = useDoc((s) => s.document.pages)
    const [state, setState] = useState<DocumentTextState>({ status: 'idle' })

    useEffect(() => {
        if (pages.length === 0) {
            setState({ status: 'empty-document' })
            return
        }
        const controller = new AbortController()
        setState({ status: 'loading', done: 0, total: pages.length })
        extractDocumentText(pages, {
            signal: controller.signal,
            onProgress: (done, total) => {
                if (!controller.signal.aborted) setState({ status: 'loading', done, total })
            },
        })
            .then((result) => {
                if (controller.signal.aborted) return
                setState({ status: 'ready', pages: result, hasText: result.some((p) => p.text.trim().length > 0) })
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted && !isCancelled(error)) setState({ status: 'error', error })
            })
        return () => controller.abort()
    }, [pages])

    return state
}
