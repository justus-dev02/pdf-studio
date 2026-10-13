import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import TextLayer from './TextLayer'

describe('TextLayer', () => {
    it('positions selectable text spans scaled by the zoom factor', () => {
        render(<TextLayer items={[{ text: 'Hallo', x: 10, y: 20, width: 50, height: 12 }]} zoom={2} enabled />)
        const span = screen.getByText('Hallo')
        expect(span.style.left).toBe('20px')
        expect(span.style.top).toBe('40px')
        expect(span.style.fontSize).toBe('24px')
    })

    it('renders nothing when disabled or empty', () => {
        const { container } = render(<TextLayer items={[{ text: 'x', x: 0, y: 0, width: 1, height: 1 }]} zoom={1} enabled={false} />)
        expect(container.firstChild).toBeNull()
        expect(render(<TextLayer items={[]} zoom={1} enabled />).container.firstChild).toBeNull()
    })
})
