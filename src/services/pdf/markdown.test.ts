import { describe, expect, it } from 'vitest'
import { openTestPdf } from '../../test/pdfFixtures'
import { groupIntoLines, pdfToMarkdown } from './markdown'
import type { PdfTextItem } from './text'

const item = (text: string, x: number, y: number, height = 12): PdfTextItem => ({ text, x, y, width: text.length * 6, height })

describe('groupIntoLines', () => {
    it('orders lines top to bottom and items left to right', () => {
        const lines = groupIntoLines([item('Welt', 60, 100), item('Unten', 10, 200), item('Hallo', 10, 101)])
        expect(lines).toEqual(['Hallo Welt', 'Unten'])
    })
})

describe('pdfToMarkdown', () => {
    const page = (n: number, body: string[]) => ({
        lines: [
            { text: 'ACME Kundenportal', x: 20, y: 280, size: 9 },
            ...body.map((text, i) => ({ text, x: 20, y: 240 - i * 20 })),
            { text: `Seite ${n} von 3`, x: 20, y: 10, size: 9 },
        ],
    })

    it('removes repeated headers and page-number footers and converts structure', async () => {
        const { pages } = await openTestPdf([page(1, ['ÜBERSICHT', '• Erster Punkt', 'Normaler Satz.']), page(2, ['Kosten:', '1) Beratung']), page(3, ['Ende.'])])
        const result = await pdfToMarkdown(pages)

        expect(result.markdown).not.toContain('ACME Kundenportal')
        expect(result.markdown).not.toMatch(/Seite \d von 3/)
        expect(result.removedLines).toBe(6)
        expect(result.markdown).toContain('## ÜBERSICHT')
        expect(result.markdown).toContain('- Erster Punkt')
        expect(result.markdown).toContain('## Kosten')
        expect(result.markdown).toContain('1. Beratung')
        expect(result.markdown).toContain('<!-- page 2 -->')
        expect(result.rawText).toContain('ACME Kundenportal')
    })

    it('keeps headers and footers when stripping is disabled', async () => {
        const { pages } = await openTestPdf([page(1, ['A.']), page(2, ['B.'])])
        const result = await pdfToMarkdown(pages, { stripHeadersFooters: false })
        expect(result.markdown).toContain('ACME Kundenportal')
        expect(result.removedLines).toBe(0)
    })

    it('ignores blank pages', async () => {
        const result = await pdfToMarkdown([{ id: 'b', kind: 'blank', format: 'A4' }])
        expect(result).toEqual({ markdown: '\n', rawText: '', removedLines: 0 })
    })
})
