import { beforeEach, describe, expect, it } from 'vitest'
import { openTestPdf } from '../../test/pdfFixtures'
import { createWebEngine, setAnalysisEngine } from './engine'
import { searchDocument } from './documentSearch'
import { isPdfError } from '../pdf'
import { EngineError } from './types'

beforeEach(() => setAnalysisEngine(createWebEngine(null)))

describe('searchDocument', () => {
    it('returns matches in reading order with normalized highlight boxes', async () => {
        const { pages } = await openTestPdf([
            { width: 400, height: 200, lines: [{ text: 'Frist am Ende', x: 100, y: 100, size: 10 }] },
            { width: 400, height: 200, lines: [{ text: 'Erste Frist', x: 0, y: 150 }, { text: 'Zweite Frist', x: 0, y: 50 }] },
        ])
        const matches = await searchDocument([pages[1], pages[0]], 'frist')

        expect(matches.map((m) => [m.pageIndex, m.pageId])).toEqual([
            [0, pages[1].id],
            [0, pages[1].id],
            [1, pages[0].id],
        ])
        const last = matches[2]
        expect(last.x).toBeCloseTo(100 / 400, 2)
        expect(last.y).toBeCloseTo((200 - 100 - 10) / 200, 2)
        expect(last.width).toBeGreaterThan(0)
        expect(last.width).toBeLessThan(0.15)
    })

    it('supports case-sensitive and regex search and skips blank pages', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'Rechnung 2026-001, rechnung 2026-002', x: 10, y: 100 }] }])
        const all = [{ id: 'blank', kind: 'blank' as const, format: 'A4' as const }, ...pages]
        expect(await searchDocument(all, 'Rechnung', { caseSensitive: true })).toHaveLength(1)
        expect(await searchDocument(all, String.raw`2026-\d{3}`, { regex: true })).toHaveLength(2)
        expect(await searchDocument(all, '   ')).toEqual([])
    })

    it('reports invalid patterns and cancellation', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'x', x: 10, y: 100 }] }])
        await expect(searchDocument(pages, '(', { regex: true })).rejects.toBeInstanceOf(EngineError)
        const controller = new AbortController()
        controller.abort()
        expect(isPdfError(await searchDocument(pages, 'x', { signal: controller.signal }).catch((e: unknown) => e), 'cancelled')).toBe(true)
    })
})
