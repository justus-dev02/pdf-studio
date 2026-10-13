import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePdfSelectionInteractions } from './usePdfSelectionInteractions'
import type { Shape } from '../../../types'

const highlight: Shape = { type: 'highlight', x: 0.2, y: 0.2, w: 0.2, h: 0.1, opacity: 0.35 }

const setup = (shapes: Shape[] = [highlight], pageId = 'p1') => {
    const updateShape = vi.fn()
    const snapshot = vi.fn()
    const hook = renderHook((props: { pageId: string; shapes: Shape[] }) => usePdfSelectionInteractions({ ...props, actions: { updateShape, snapshot } }), {
        initialProps: { pageId, shapes },
    })
    return { hook, updateShape, snapshot }
}

describe('usePdfSelectionInteractions', () => {
    it('selects a shape on click without writing history', () => {
        const { hook, snapshot } = setup()
        let mode = ''
        act(() => {
            mode = hook.result.current.beginSelection({ x: 0.3, y: 0.25 }).nextMode
        })
        expect(mode).toBe('dragging')
        expect(hook.result.current.selectedIndex).toBe(0)
        act(() => hook.result.current.resetInteraction())
        expect(snapshot).not.toHaveBeenCalled()
    })

    it('records one undo step for a whole drag', () => {
        const { hook, snapshot, updateShape } = setup()
        act(() => void hook.result.current.beginSelection({ x: 0.3, y: 0.25 }))
        act(() => void hook.result.current.updateDrag({ x: 0.35, y: 0.25 }))
        act(() => void hook.result.current.updateDrag({ x: 0.4, y: 0.3 }))
        expect(snapshot).toHaveBeenCalledOnce()
        const [pageId, index, moved, options] = updateShape.mock.calls[1]
        expect([pageId, index, options]).toEqual(['p1', 0, { record: false }])
        expect(moved.x).toBeCloseTo(0.3)
        expect(moved.y).toBeCloseTo(0.25)
    })

    it('resizes from a corner handle and enforces a minimum size', () => {
        const { hook, updateShape } = setup()
        let mode = ''
        act(() => {
            mode = hook.result.current.beginSelection({ x: 0.4, y: 0.3 }).nextMode
        })
        expect(mode).toBe('resizing')
        act(() => void hook.result.current.updateResize({ x: 0.1, y: 0.1 }))
        const resized = updateShape.mock.calls[0][2]
        expect(resized.w).toBeCloseTo(0.02)
        expect(resized.h).toBeCloseTo(0.02)
    })

    it('clears the selection on empty space and when the page changes', () => {
        const { hook } = setup()
        act(() => void hook.result.current.beginSelection({ x: 0.3, y: 0.25 }))
        hook.rerender({ pageId: 'p2', shapes: [highlight] })
        expect(hook.result.current.selectedIndex).toBeNull()

        hook.rerender({ pageId: 'p1', shapes: [highlight] })
        act(() => void hook.result.current.beginSelection({ x: 0.9, y: 0.9 }))
        expect(hook.result.current.selectedIndex).toBeNull()
        expect(hook.result.current.updateDrag({ x: 0, y: 0 })).toBe(false)
    })
})
