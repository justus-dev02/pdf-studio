import type { PageRef, SearchMatch } from '../../types'
import { boxesInRange, getPageText } from '../pdf/text'
import { throwIfAborted } from '../pdf/errors'
import { getAnalysisEngine } from './engine'
import type { PageInput } from './types'

export type DocumentSearchOptions = {
    caseSensitive?: boolean
    regex?: boolean
    signal?: AbortSignal
}

/** Hard cap so a pattern like `e` in a 1000-page document cannot freeze the UI. */
export const MAX_SEARCH_RESULTS = 2000

/**
 * Full-text search over the document: text comes from the page text cache, matching runs
 * in the analysis engine (Rust or Web Worker), and every match is mapped back to the
 * text items it covers so the viewer can highlight it.
 */
export async function searchDocument(pages: PageRef[], query: string, options: DocumentSearchOptions = {}): Promise<SearchMatch[]> {
    if (!query.trim()) return []

    const inputs: PageInput[] = []
    const pageByNumber = new Map<number, Extract<PageRef, { kind: 'pdf' }>>()
    for (let i = 0; i < pages.length; i++) {
        throwIfAborted(options.signal)
        const page = pages[i]
        if (page.kind !== 'pdf') continue
        const { text } = await getPageText(page)
        inputs.push({ page_number: i + 1, text })
        pageByNumber.set(i + 1, page)
    }
    throwIfAborted(options.signal)

    const result = await getAnalysisEngine().search(inputs, {
        query,
        case_sensitive: options.caseSensitive ?? false,
        is_regex: options.regex ?? false,
        max_results_per_page: 0,
        snippet_padding: 0,
    })
    throwIfAborted(options.signal)

    // Navigation through results follows reading order, not relevance.
    const ordered = [...result.matches].sort((a, b) => a.page_number - b.page_number || a.char_offset - b.char_offset).slice(0, MAX_SEARCH_RESULTS)

    const matches: SearchMatch[] = []
    for (const match of ordered) {
        const page = pageByNumber.get(match.page_number)
        if (!page) continue
        const pageText = await getPageText(page)
        const items = boxesInRange(pageText, match.char_offset, match.char_offset + match.match_length)
        if (items.length === 0) continue
        const left = Math.min(...items.map((i) => i.x))
        const top = Math.min(...items.map((i) => i.y))
        const right = Math.max(...items.map((i) => i.x + i.width))
        const bottom = Math.max(...items.map((i) => i.y + i.height))
        matches.push({
            pageId: page.id,
            pageIndex: match.page_number - 1,
            text: match.snippet,
            x: left / pageText.width,
            y: top / pageText.height,
            width: (right - left) / pageText.width,
            height: (bottom - top) / pageText.height,
        })
    }
    return matches
}
