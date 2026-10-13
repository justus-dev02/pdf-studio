import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createPdf, openTestPdf, readFixture } from '../../test/pdfFixtures'
import { isPdfError } from './errors'
import { exportPdf, hexToRgb, parseDataUrl, toEncodableText } from './export'
import { registerSource } from './sourceRegistry'
import { getPageText } from './text'
import { openPdfSource } from './sources'
import type { PageOverlays, PageRef } from '../../types'

/** 1×1 transparent PNG */
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function reopen(bytes: Uint8Array) {
    const source = await openPdfSource(bytes, 'export.pdf')
    const pages: PageRef[] = Array.from({ length: source.pageCount }, (_, index) => ({ id: `out-${index}`, kind: 'pdf', sourceKey: source.key, index }))
    return { source, pages }
}

describe('exportPdf', () => {
    it('keeps page order across sources and blank pages', async () => {
        const a = await openTestPdf([{ width: 300, height: 300, lines: [{ text: 'A1', x: 10, y: 10 }] }, { width: 310, height: 300, lines: [{ text: 'A2', x: 10, y: 10 }] }])
        const b = await openTestPdf([{ width: 500, height: 400, lines: [{ text: 'B1', x: 10, y: 10 }] }])
        const order: PageRef[] = [b.pages[0], a.pages[1], { id: 'blank', kind: 'blank', format: 'Custom', customDimensions: { width: 200, height: 100 } }, a.pages[0]]

        const out = await PDFDocument.load(await exportPdf(order, {}))
        expect(out.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([
            [500, 400],
            [310, 300],
            [200, 100],
            [300, 300],
        ])
    })

    it('flattens text overlays into the page content at the right position', async () => {
        const { pages } = await openTestPdf([{ width: 400, height: 400 }])
        const overlays: PageOverlays = {
            [pages[0].id]: [{ type: 'text', x: 0.25, y: 0.5, w: 0.5, h: 0.1, text: 'Größe ändern', fontSize: 12, fontFamily: 'Helvetica', color: '#ff0000' }],
        }
        const exported = await reopen(await exportPdf(pages, overlays))
        const text = await getPageText(exported.pages[0])
        expect(text.text).toContain('Größe ändern')
        const item = text.items[0]
        expect(item.x).toBeCloseTo(0.25 * 400 + 2, 0)
        expect(item.y).toBeGreaterThanOrEqual(0.5 * 400 - 1)
        expect(item.y).toBeLessThan(0.6 * 400)
    })

    it('draws every shape type without errors and embeds images once', async () => {
        const { pages } = await openTestPdf([{}, {}])
        const stamp = { type: 'stamp' as const, x: 0.1, y: 0.1, w: 0.2, h: 0.1, imageDataUrl: PNG_DATA_URL }
        const overlays: PageOverlays = {
            [pages[0].id]: [
                { type: 'highlight', x: 0.1, y: 0.1, w: 0.2, h: 0.1, opacity: 0.4, color: '#eab308' },
                { type: 'pen', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.1 }], width: 0.003, color: '#3b82f6' },
                { type: 'checkbox', x: 0.5, y: 0.5, size: 0.05, checked: true },
                { type: 'checkbox', x: 0.6, y: 0.5, size: 0.05, checked: false },
                stamp,
            ],
            [pages[1].id]: [stamp],
        }
        const bytes = await exportPdf(pages, overlays)
        const out = await PDFDocument.load(bytes)
        expect(out.getPageCount()).toBe(2)
        // One embed of a PNG with alpha channel = one image XObject plus its soft mask.
        const imageObjects = new TextDecoder('latin1').decode(bytes).match(/\/Subtype\s*\/Image/g) ?? []
        expect(imageObjects).toHaveLength(2)
    })

    it('replaces characters the standard fonts cannot encode instead of crashing', async () => {
        const { pages } = await openTestPdf([{}])
        const overlays: PageOverlays = { [pages[0].id]: [{ type: 'text', x: 0.1, y: 0.1, w: 0.8, h: 0.2, text: 'Hi 🙂 ✓', fontSize: 12, fontFamily: 'Courier' }] }
        const exported = await reopen(await exportPdf(pages, overlays))
        expect((await getPageText(exported.pages[0])).text).toMatch(/^Hi\s+\?\s+\?$/)
    })

    it('refuses to export encrypted sources with a typed error', async () => {
        const key = registerSource(readFixture('encrypted.pdf'), 'secret')
        const error = await exportPdf([{ id: 'p', kind: 'pdf', sourceKey: key, index: 0 }], {}).catch((e: unknown) => e)
        expect(isPdfError(error, 'encrypted-export')).toBe(true)
    })

    it('rejects stamps in formats PDF cannot embed', async () => {
        const { pages } = await openTestPdf([{}])
        const overlays: PageOverlays = { [pages[0].id]: [{ type: 'stamp', x: 0, y: 0, w: 0.1, h: 0.1, imageDataUrl: 'data:image/webp;base64,AAAA' }] }
        const error = await exportPdf(pages, overlays).catch((e: unknown) => e)
        expect(isPdfError(error, 'unsupported-image')).toBe(true)
    })

    it('reports page indices that do not exist in the source', async () => {
        const { source } = await openTestPdf([{}])
        const error = await exportPdf([{ id: 'p', kind: 'pdf', sourceKey: source.key, index: 3 }], {}).catch((e: unknown) => e)
        expect(isPdfError(error, 'page-out-of-range')).toBe(true)
    })

    it('stops between pages when aborted', async () => {
        const { pages } = await openTestPdf([{}, {}])
        const controller = new AbortController()
        controller.abort()
        const error = await exportPdf(pages, {}, { signal: controller.signal }).catch((e: unknown) => e)
        expect(isPdfError(error, 'cancelled')).toBe(true)
    })
})

describe('export helpers', () => {
    it('parses colors with fallbacks', () => {
        expect(hexToRgb('#ff0000')).toMatchObject({ red: 1, green: 0, blue: 0 })
        expect(hexToRgb('not-a-color', '#000000')).toMatchObject({ red: 0, green: 0, blue: 0 })
        expect(hexToRgb(undefined, '#ffffff')).toMatchObject({ red: 1, green: 1, blue: 1 })
    })

    it('parses base64 data URLs', () => {
        const { mime, bytes } = parseDataUrl(PNG_DATA_URL)
        expect(mime).toBe('image/png')
        expect([...bytes.slice(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG')
        expect(() => parseDataUrl('data:text/plain,hello')).toThrow()
    })

    it('keeps encodable characters including German umlauts', async () => {
        const doc = await PDFDocument.create()
        const font = await doc.embedFont(StandardFonts.Helvetica)
        expect(toEncodableText('Äpfel & Öl – 5 €\nZeile 2 ✓', font)).toBe('Äpfel & Öl – 5 €\nZeile 2 ?')
    })

    it('exports a blank document without any sources', async () => {
        const out = await PDFDocument.load(await exportPdf([{ id: 'b', kind: 'blank', format: 'A4' }], {}))
        expect(out.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 })
        expect(await createPdf([{}])).toBeInstanceOf(Uint8Array)
    })
})
