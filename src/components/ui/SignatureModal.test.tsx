import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SignatureModal from './SignatureModal'
import { useDoc } from '../../store'

describe('SignatureModal', () => {
    it('enables "apply" only after drawing and stores the signature as stamp', () => {
        const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn() }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,SIG')
        const onClose = vi.fn()
        render(<SignatureModal onClose={onClose} />)

        const apply = screen.getByRole('button', { name: 'Übernehmen' })
        expect(apply).toBeDisabled()

        const canvas = screen.getByLabelText('Unterschriftenfeld')
        fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 })
        fireEvent.pointerMove(canvas, { clientX: 50, clientY: 40, pointerId: 1 })
        fireEvent.pointerUp(canvas)
        expect(ctx.stroke).toHaveBeenCalled()
        expect(apply).toBeEnabled()

        fireEvent.click(apply)
        expect(useDoc.getState().document.stampImage).toBe('data:image/png;base64,SIG')
        expect(useDoc.getState().viewer.tool).toBe('stamp')
        expect(onClose).toHaveBeenCalled()
    })

    it('can be cleared and cancelled', () => {
        const onClose = vi.fn()
        render(<SignatureModal onClose={onClose} />)
        fireEvent.click(screen.getByRole('button', { name: 'Leeren' }))
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
        expect(onClose).toHaveBeenCalled()
    })
})
