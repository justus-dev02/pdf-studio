import { describe, expect, it } from 'vitest'
import { getBBox, hitTestIndex, resizeShape, translateShape } from './shapes'
import type { Checkbox, Highlight, PenPath, Shape, Stamp, TextBox } from '../types'

describe('shapes geometry & manipulation utilities', () => {
    it('resizes highlight and text boxes to target bounds', () => {
        const highlight: Highlight = { type: 'highlight', x: 0.1, y: 0.1, w: 0.2, h: 0.2, opacity: 0.4 }
        const from = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }
        const to = { x: 0.2, y: 0.3, w: 0.4, h: 0.1 }
        const resizedHighlight = resizeShape(highlight, from, to)
        expect(resizedHighlight).toMatchObject({ x: 0.2, y: 0.3, w: 0.4, h: 0.1 })

        const text: TextBox = { type: 'text', x: 0.2, y: 0.2, w: 0.2, h: 0.2, text: 'Hi', fontSize: 12, fontFamily: 'Helvetica' }
        const resizedText = resizeShape(text, from, to)
        expect(resizedText).toMatchObject({ x: 0.2, y: 0.3, w: 0.4, h: 0.1 })
    })

    it('keeps checkboxes square while resizing', () => {
        const checkbox: Checkbox = { type: 'checkbox', x: 0.1, y: 0.1, size: 0.08, checked: true }
        const from = { x: 0.1, y: 0.1, w: 0.08, h: 0.08 }
        const to = { x: 0.2, y: 0.2, w: 0.3, h: 0.12 }
        const resized = resizeShape(checkbox, from, to) as Checkbox
        expect(resized.x).toBeCloseTo(0.2)
        expect(resized.y).toBeCloseTo(0.2)
        expect(resized.size).toBeCloseTo(0.12)
    })

    it('resizes stamps preserving image data', () => {
        const stamp: Stamp = { type: 'stamp', x: 0.1, y: 0.1, w: 0.2, h: 0.1, imageDataUrl: 'data:image/png;base64,123' }
        const from = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }
        const to = { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }
        const resized = resizeShape(stamp, from, to) as Stamp
        expect(resized.x).toBeCloseTo(0.3)
        expect(resized.w).toBeCloseTo(0.4)
        expect(resized.imageDataUrl).toBe('data:image/png;base64,123')
    })

    it('scales pen points and stroke width based on the bbox', () => {
        const pen: PenPath = { type: 'pen', points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }], width: 0.01 }
        const from = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }
        const to = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }
        const resized = resizeShape(pen, from, to) as PenPath
        expect(resized.points[1].x).toBeCloseTo(0.5)
        expect(resized.points[1].y).toBeCloseTo(0.5)
        expect(resized.width).toBeCloseTo(0.02)
    })

    it('clamps translated positions to bounds', () => {
        const text: TextBox = { type: 'text', x: 0.95, y: 0.96, w: 0.1, h: 0.1, text: 'Edge', fontSize: 12, fontFamily: 'Helvetica' }
        const moved = translateShape(text, 0.2, 0.1) as TextBox
        expect(moved.x).toBeCloseTo(1)
        expect(moved.y).toBeCloseTo(1)

        const checkbox: Checkbox = { type: 'checkbox', x: 0.5, y: 0.5, size: 0.05, checked: true }
        const movedBox = translateShape(checkbox, -0.2, 0.1) as Checkbox
        expect(movedBox.x).toBeCloseTo(0.3)
        expect(movedBox.y).toBeCloseTo(0.6)
    })

    it('calculates bounding boxes for all shape types', () => {
        const highlight: Highlight = { type: 'highlight', x: 0.1, y: 0.2, w: 0.3, h: 0.4, opacity: 0.5 }
        expect(getBBox(highlight)).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })

        const checkbox: Checkbox = { type: 'checkbox', x: 0.1, y: 0.2, size: 0.05, checked: true }
        expect(getBBox(checkbox)).toEqual({ x: 0.1, y: 0.2, w: 0.05, h: 0.05 })

        const pen: PenPath = { type: 'pen', points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.5 }], width: 0.01 }
        const bbox = getBBox(pen)
        expect(bbox.x).toBeLessThan(0.2)
        expect(bbox.y).toBeLessThan(0.2)
    })

    it('hit tests shapes by index correctly (topmost shape prioritized)', () => {
        const shapes: Shape[] = [
            { type: 'highlight', x: 0.1, y: 0.1, w: 0.5, h: 0.5, opacity: 0.3 },
            { type: 'checkbox', x: 0.2, y: 0.2, size: 0.1, checked: true },
        ]

        // Hits the checkbox (topmost shape)
        expect(hitTestIndex(shapes, 0.22, 0.22)).toBe(1)

        // Hits the highlight shape only
        expect(hitTestIndex(shapes, 0.12, 0.12)).toBe(0)

        // Misses all shapes
        expect(hitTestIndex(shapes, 0.9, 0.9)).toBeNull()
    })
})
