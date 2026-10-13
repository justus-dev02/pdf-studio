/**
 * Mirrors the tests in src-tauri/src/engine/search.rs.
 */
import { describe, expect, it } from 'vitest'
import { buildSnippet, escapeRegex, searchPages } from './search'
import { EngineError } from './types'
import type { SearchOptions } from './types'

const options = (query: string, patch: Partial<SearchOptions> = {}): SearchOptions => ({
    query,
    case_sensitive: false,
    is_regex: false,
    max_results_per_page: 0,
    snippet_padding: 10,
    ...patch,
})
const page = (page_number: number, text: string) => ({ page_number, text })

describe('searchPages (parity with Rust engine)', () => {
    it('finds plain matches case-insensitively', () => {
        const result = searchPages([page(1, 'PDF Studio is a privacy-first pdf editor.'), page(2, 'Built with React, TypeScript, and Rust.')], options('PDF'))
        expect(result.total_matches).toBe(2)
        expect(result.matches.every((m) => m.page_number === 1)).toBe(true)
    })

    it('respects case sensitivity', () => {
        expect(searchPages([page(1, 'PDF pdf Pdf')], options('PDF', { case_sensitive: true })).total_matches).toBe(1)
    })

    it('supports regex patterns', () => {
        const result = searchPages([page(1, 'Contact info@example.com or support@pdfstudio.io')], options(String.raw`[\w.-]+@[\w.-]+\.\w+`, { is_regex: true }))
        expect(result.total_matches).toBe(2)
    })

    it('escapes regex metacharacters in plain mode', () => {
        expect(searchPages([page(1, 'Kosten (netto): 5.00 EUR, 5x00 EUR')], options('5.00')).total_matches).toBe(1)
        expect(escapeRegex('a.b*(c)')).toBe(String.raw`a\.b\*\(c\)`)
    })

    it('rejects invalid regex with a typed error', () => {
        expect(() => searchPages([page(1, 'text')], options('(unclosed', { is_regex: true }))).toThrow(EngineError)
    })

    it('handles multi-byte characters around matches', () => {
        const text = 'äöüßäöüßäöüß Frist äöüßäöüßäöüß 🙂🙂🙂'
        for (let padding = 1; padding < 20; padding++) {
            const result = searchPages([page(1, text)], options('Frist', { snippet_padding: padding }))
            expect(result.total_matches).toBe(1)
            expect(result.matches[0].snippet).toContain('Frist')
            expect(result.matches[0].snippet).not.toMatch(/�/)
        }
    })

    it('reports UTF-16 offsets (JavaScript string indices)', () => {
        const result = searchPages([page(1, '🙂ä Treffer und Treffer')], options('Treffer'))
        expect(result.matches.map((m) => m.char_offset).sort((a, b) => a - b)).toEqual([4, 16])
        expect(result.matches.every((m) => m.match_length === 7)).toBe(true)
    })

    it('limits results per page and ignores empty matches', () => {
        expect(searchPages([page(1, 'a a a a a')], options('a', { max_results_per_page: 2 })).total_matches).toBe(2)
        expect(searchPages([page(1, 'abc')], options('x*', { is_regex: true })).total_matches).toBe(0)
        expect(searchPages([page(1, 'abc')], options('   ')).total_matches).toBe(0)
    })

    it('builds snippets with character padding and ellipsis', () => {
        const text = '0123456789 match 0123456789'
        const start = text.indexOf('match')
        expect(buildSnippet(text, start, start + 5, 3)).toBe('...89 match 01...')
    })
})
