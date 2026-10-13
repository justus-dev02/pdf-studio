import { describe, expect, it, vi } from 'vitest'
import { openTestPdf } from '../../test/pdfFixtures'
import * as documentCache from './documentCache'
import { isPdfError } from './errors'
import { boxesInRange, extractDocumentText, getPageText } from './text'
import type { PageRef } from '../../types'

describe('getPageText', () => {
    it('returns items in top-left page coordinates (PDF points)', async () => {
        const { pages } = await openTestPdf([{ width: 400, height: 300, lines: [{ text: 'Hallo Welt', x: 40, y: 240, size: 24 }] }])
        const text = await getPageText(pages[0])

        expect(text.width).toBe(400)
        expect(text.height).toBe(300)
        expect(text.items).toHaveLength(1)
        const [item] = text.items
        expect(item.text).toBe('Hallo Welt')
        expect(item.x).toBeCloseTo(40)
        // Baseline at 240 from the bottom → top edge 300 - 240 - 24 = 36 from the top.
        expect(item.y).toBeCloseTo(36)
        expect(item.height).toBeCloseTo(24)
    })

    it('joins items into page text with line breaks and keeps a span index', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'Erste Zeile', x: 20, y: 250 }, { text: 'Zweite Zeile', x: 20, y: 200 }] }])
        const text = await getPageText(pages[0])
        expect(text.text).toContain('Erste Zeile')
        expect(text.text).toContain('Zweite Zeile')
        for (const span of text.spans) expect(text.text.slice(span.start, span.end)).toBe(text.items[span.item].text)
    })

    it('extracts each page only once (cached)', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'Cache', x: 10, y: 100 }] }])
        const spy = vi.spyOn(documentCache, 'getPdfDocument')
        const first = await getPageText(pages[0])
        const second = await getPageText(pages[0])
        expect(second).toBe(first)
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('returns an empty text for blank pages with the paper size', async () => {
        const blank: PageRef = { id: 'b', kind: 'blank', format: 'Letter' }
        await expect(getPageText(blank)).resolves.toEqual({ width: 612, height: 792, items: [], text: '', spans: [] })
    })

    it('rejects page indices outside the document', async () => {
        const { source } = await openTestPdf([{}])
        const error = await getPageText({ id: 'x', kind: 'pdf', sourceKey: source.key, index: 5 }).catch((e: unknown) => e)
        expect(isPdfError(error, 'page-out-of-range')).toBe(true)
    })
})

describe('boxesInRange', () => {
    it('cuts partially covered items proportionally', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'abcdefghij', x: 0, y: 100 }] }])
        const text = await getPageText(pages[0])
        const item = text.items[0]
        const [box] = boxesInRange(text, 2, 5)
        expect(box.text).toBe('cde')
        expect(box.x).toBeCloseTo(item.x + item.width * 0.2)
        expect(box.width).toBeCloseTo(item.width * 0.3)
    })
})

describe('extractDocumentText', () => {
    it('returns page numbers in document order, skips blank pages and reports progress', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'Eins', x: 10, y: 100 }] }, { lines: [{ text: 'Zwei', x: 10, y: 100 }] }])
        const all: PageRef[] = [pages[1], { id: 'blank', kind: 'blank', format: 'A4' }, pages[0]]
        const progress = vi.fn()
        const result = await extractDocumentText(all, { onProgress: progress })
        expect(result.map((p) => [p.pageNumber, p.text])).toEqual([
            [1, 'Zwei'],
            [3, 'Eins'],
        ])
        expect(progress).toHaveBeenLastCalledWith(3, 3)
    })

    it('stops when aborted', async () => {
        const { pages } = await openTestPdf([{}, {}])
        const controller = new AbortController()
        controller.abort()
        const error = await extractDocumentText(pages, { signal: controller.signal }).catch((e: unknown) => e)
        expect(isPdfError(error, 'cancelled')).toBe(true)
    })
})
