import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import PdfOverlays from './PdfOverlays'
import SearchHighlights from './SearchHighlights'
import type { Shape } from '../../../types'

const pageSize = { width: 600, height: 800 }

describe('PdfOverlays', () => {
    const shapes: Shape[] = [
        { type: 'highlight', x: 0.1, y: 0.1, w: 0.2, h: 0.1, opacity: 0.35, color: '#eab308' },
        { type: 'pen', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], width: 0.005, color: '#ef4444' },
        { type: 'text', x: 0.1, y: 0.2, w: 0.3, h: 0.1, text: 'Hello Overlay', fontSize: 14, fontFamily: 'TimesRoman' },
        { type: 'checkbox', x: 0.5, y: 0.5, size: 0.05, checked: true },
        { type: 'stamp', x: 0.6, y: 0.6, w: 0.2, h: 0.1, imageDataUrl: 'data:image/png;base64,AA==' },
    ]

    it('renders every shape type', () => {
        const { container } = render(<PdfOverlays shapes={shapes} tempShape={null} editingIndex={null} zoom={1} pageSize={pageSize} />)
        expect(container.querySelector('foreignObject')).not.toBeNull()
        expect(container.querySelector('image')).not.toBeNull()
        expect(container.textContent).toContain('Hello Overlay')
    })

    it('draws pen paths in a normalized viewBox (SVG path data has no % units)', () => {
        const { container } = render(<PdfOverlays shapes={[shapes[1]]} tempShape={null} editingIndex={null} zoom={2} pageSize={pageSize} />)
        const path = container.querySelector('path')
        expect(path?.getAttribute('d')).toBe('M0.1 0.1 L0.2 0.2')
        expect(path?.getAttribute('d')).not.toContain('%')
        expect(path?.closest('svg')?.getAttribute('viewBox')).toBe('0 0 1 1')
        // Same unit as the export: width × shorter page side × zoom.
        expect(Number(path?.getAttribute('stroke-width'))).toBeCloseTo(0.005 * 600 * 2)
    })

    it('renders checkboxes as squares relative to the shorter page side', () => {
        const { container } = render(<PdfOverlays shapes={[shapes[3]]} tempShape={null} editingIndex={null} zoom={1} pageSize={pageSize} />)
        const box = container.querySelector('svg svg')
        expect(box?.getAttribute('width')).toBe(box?.getAttribute('height'))
        expect(Number(box?.getAttribute('width'))).toBeCloseTo(30)
    })

    it('hides the text shape being edited and shows the drawing preview', () => {
        const { container } = render(<PdfOverlays shapes={shapes} tempShape={shapes[0]} editingIndex={2} zoom={1} pageSize={pageSize} />)
        expect(container.textContent).not.toContain('Hello Overlay')
        expect(container.querySelectorAll('rect[stroke="orange"]')).toHaveLength(1)
    })
})

describe('SearchHighlights', () => {
    it('emphasizes the current match', () => {
        const match = { pageId: 'p', pageIndex: 0, text: 't', x: 0.1, y: 0.1, width: 0.1, height: 0.02 }
        const { container } = render(<SearchHighlights matches={[match, { ...match, x: 0.5 }]} currentIndex={1} label="Treffer" />)
        const rects = container.querySelectorAll('rect')
        expect(rects).toHaveLength(2)
        expect(rects[1].getAttribute('data-current')).toBe('true')
        expect(render(<SearchHighlights matches={[]} currentIndex={-1} label="x" />).container.firstChild).toBeNull()
    })
})
