import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePdfDrawingInteractions } from './usePdfDrawingInteractions'

const setup = (shapeCount = 0) => {
    const pushOverlay = vi.fn()
    const onSelectIndex = vi.fn()
    const hook = renderHook(() => usePdfDrawingInteractions({ pageId: 'p1', shapeCount, activeColor: '#ef4444', strokeWidth: 0.004, actions: { pushOverlay }, onSelectIndex }))
    return { hook, pushOverlay, onSelectIndex }
}

describe('usePdfDrawingInteractions', () => {
    it('draws a highlight rectangle in any drag direction and selects it', () => {
        const { hook, pushOverlay, onSelectIndex } = setup(2)
        act(() => hook.result.current.beginDrawing('highlight', { x: 0.5, y: 0.5 }))
        act(() => hook.result.current.updateDrawing('highlight', { x: 0.2, y: 0.3 }))
        expect(hook.result.current.tempShape).toMatchObject({ type: 'highlight', x: 0.2, y: 0.3, color: '#ef4444' })
        act(() => hook.result.current.commitDrawing())

        const [, shape] = pushOverlay.mock.calls[0]
        expect(shape.w).toBeCloseTo(0.3)
        expect(shape.h).toBeCloseTo(0.2)
        expect(onSelectIndex).toHaveBeenCalledWith(2)
        expect(hook.result.current.tempShape).toBeNull()
    })

    it('collects pen points, skipping jitter below the minimum distance', () => {
        const { hook, pushOverlay } = setup()
        act(() => hook.result.current.beginDrawing('pen', { x: 0.1, y: 0.1 }))
        act(() => hook.result.current.updateDrawing('pen', { x: 0.1005, y: 0.1 }))
        act(() => hook.result.current.updateDrawing('pen', { x: 0.2, y: 0.2 }))
        act(() => hook.result.current.commitDrawing())
        expect(pushOverlay).toHaveBeenCalledWith('p1', { type: 'pen', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], width: 0.004, color: '#ef4444' })
    })

    it('discards accidental clicks (too small or single point)', () => {
        const { hook, pushOverlay } = setup()
        act(() => hook.result.current.beginDrawing('highlight', { x: 0.5, y: 0.5 }))
        act(() => hook.result.current.updateDrawing('highlight', { x: 0.501, y: 0.501 }))
        act(() => hook.result.current.commitDrawing())
        act(() => hook.result.current.beginDrawing('pen', { x: 0.5, y: 0.5 }))
        act(() => hook.result.current.commitDrawing())
        act(() => hook.result.current.beginDrawing('pen', { x: 0.5, y: 0.5 }))
        act(() => hook.result.current.clearDrawing())
        expect(pushOverlay).not.toHaveBeenCalled()
        expect(hook.result.current.tempShape).toBeNull()
    })
})
