import { describe, expect, it } from 'vitest'
import { openTestPdf } from '../../test/pdfFixtures'
import { detectFormFields, isFieldLabel } from './formFields'

describe('isFieldLabel', () => {
    it.each([
        ['Name:', true],
        ['Datum', true],
        ['E-Mail-Adresse:', true],
        ['Unterschrift: ________', true],
        ['__________', true],
        ['Ort, Datum ..........', true],
        ['Die Frist endet am Montag.', false],
        ['Firmenname der Muster GmbH und weitere sehr lange Beschreibung ohne Doppelpunkt', false],
        ['Ordnung', false],
        ['', false],
    ])('%s → %s', (text, expected) => {
        expect(isFieldLabel(text)).toBe(expected)
    })
})

describe('detectFormFields', () => {
    it('places fields next to labels using the real page size (A3 landscape)', async () => {
        const { pages } = await openTestPdf([{ width: 1190, height: 842, lines: [{ text: 'Name:', x: 100, y: 742, size: 12 }] }])
        const [field] = await detectFormFields(pages)

        expect(field.pageId).toBe(pages[0].id)
        expect(field.label).toBe('Name:')
        const labelRight = (100 + field.label.length * 6) / 1190
        expect(field.shape.x).toBeGreaterThan(100 / 1190)
        expect(field.shape.x).toBeLessThan(labelRight + 0.05)
        // Label top edge is at (842 - 742 - 12) / 842 ≈ 0.105 from the top.
        expect(field.shape.y).toBeGreaterThan(0.09)
        expect(field.shape.y).toBeLessThan(0.12)
        expect(field.shape.x + field.shape.w).toBeLessThanOrEqual(1)
    })

    it('covers placeholder lines instead of placing a field next to them', async () => {
        const { pages } = await openTestPdf([{ width: 400, height: 300, lines: [{ text: '______________', x: 50, y: 100 }] }])
        const [field] = await detectFormFields(pages)
        expect(field.shape.x).toBeCloseTo(50 / 400, 2)
    })

    it('keeps fields inside the page for labels at the right edge', async () => {
        const { pages } = await openTestPdf([{ width: 400, height: 300, lines: [{ text: 'PLZ:', x: 370, y: 100 }] }])
        const [field] = await detectFormFields(pages)
        expect(field.shape.x + field.shape.w).toBeLessThanOrEqual(1)
    })

    it('skips blank pages and pages without labels', async () => {
        const { pages } = await openTestPdf([{ lines: [{ text: 'Nur Fließtext ohne Felder.', x: 10, y: 100 }] }])
        expect(await detectFormFields([...pages, { id: 'b', kind: 'blank', format: 'A4' }])).toEqual([])
    })
})
