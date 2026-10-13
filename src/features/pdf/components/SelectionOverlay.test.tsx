import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import SelectionOverlay from './SelectionOverlay'

describe('SelectionOverlay component', () => {
    it('renders bounding box rect and 4 corner resize handles', () => {
        const shape = { type: 'highlight' as const, x: 0.1, y: 0.1, w: 0.3, h: 0.3, opacity: 0.4 }
        const { container } = render(<SelectionOverlay shape={shape} />)

        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBe(5) // 1 bounding box rect + 4 corner handle rects
        // Regression: without explicit size the SVG falls back to 300×150 px and the box is drawn far too small.
        expect(container.querySelector('svg')).toHaveClass('h-full', 'w-full')
    })
})
