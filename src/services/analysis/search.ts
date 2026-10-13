/**
 * Browser implementation of `src-tauri/src/engine/search.rs` (same options, scoring and output).
 */
import { EngineError } from './types'
import type { EngineSearchMatch, PageInput, SearchOptions, SearchResult } from './types'

const DEFAULT_SNIPPET_PADDING = 40

export function buildSearchRegex(options: SearchOptions): RegExp {
    const source = options.is_regex ? options.query : escapeRegex(options.query)
    try {
        return new RegExp(source, options.case_sensitive ? 'gu' : 'giu')
    } catch (error) {
        throw new EngineError('invalid-pattern', error instanceof Error ? error.message : String(error), { cause: error })
    }
}

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function searchPages(pages: PageInput[], options: SearchOptions): SearchResult {
    const start = performance.now()
    if (!options.query.trim() || pages.length === 0) {
        return { total_matches: 0, duration_ms: 0, matches: [] }
    }

    const regex = buildSearchRegex(options)
    const padding = options.snippet_padding || DEFAULT_SNIPPET_PADDING
    const matches: EngineSearchMatch[] = []

    for (const page of pages) {
        const found = [...page.text.matchAll(regex)].filter((m) => m[0].length > 0)
        if (found.length === 0) continue

        const pageChars = Math.max(1, [...page.text].length)
        const termFrequency = found.length / Math.max(1, pageChars / 100)
        const pageWeight = 1 / (page.page_number / pages.length + 1)
        const score = termFrequency * pageWeight
        const limit = options.max_results_per_page > 0 ? Math.min(options.max_results_per_page, found.length) : found.length

        for (let i = 0; i < limit; i++) {
            const match = found[i]
            const offset = match.index ?? 0
            matches.push({
                page_number: page.page_number,
                match_index: i + 1,
                char_offset: offset,
                match_length: match[0].length,
                snippet: buildSnippet(page.text, offset, offset + match[0].length, padding),
                score,
            })
        }
    }

    matches.sort((a, b) => b.score - a.score || a.page_number - b.page_number || a.char_offset - b.char_offset)
    return { total_matches: matches.length, duration_ms: Math.round(performance.now() - start), matches }
}

/** `padding` counts code points, so surrogate pairs (emoji) are never split. */
export function buildSnippet(text: string, start: number, end: number, padding: number): string {
    const before = [...text.slice(0, start)]
    const after = [...text.slice(end)]
    const head = before.slice(Math.max(0, before.length - padding)).join('')
    const tail = after.slice(0, padding).join('')
    const prefix = before.length > padding ? '...' : ''
    const suffix = after.length > padding ? '...' : ''
    return `${prefix}${head}${text.slice(start, end)}${tail}${suffix}`.replace(/[\r\n]/g, ' ')
}
