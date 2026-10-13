import { useEffect, useState } from 'react'
import { getAnalysisEngine } from '../../services/analysis/engine'
import type { NlpAnalysisResult } from '../../services/analysis/types'
import type { DocumentPageText } from '../../services/pdf'

/** One analysis per extracted text snapshot, shared by all tabs (keyed by array identity). */
const cache = new WeakMap<DocumentPageText[], Promise<NlpAnalysisResult>>()

export function analyzePages(pages: DocumentPageText[]): Promise<NlpAnalysisResult> {
    let result = cache.get(pages)
    if (!result) {
        result = getAnalysisEngine().analyzeText(pages.map((p) => ({ page_number: p.pageNumber, text: p.text })))
        result.catch(() => cache.delete(pages))
        cache.set(pages, result)
    }
    return result
}

export type TextAnalysisState = { status: 'running' } | { status: 'done'; value: NlpAnalysisResult } | { status: 'error'; error: unknown }

export function useTextAnalysis(pages: DocumentPageText[]): TextAnalysisState {
    const [state, setState] = useState<TextAnalysisState>({ status: 'running' })

    useEffect(() => {
        let active = true
        setState({ status: 'running' })
        analyzePages(pages)
            .then((value) => active && setState({ status: 'done', value }))
            .catch((error: unknown) => active && setState({ status: 'error', error }))
        return () => {
            active = false
        }
    }, [pages])

    return state
}
