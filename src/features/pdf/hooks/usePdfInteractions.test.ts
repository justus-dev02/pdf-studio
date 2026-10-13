import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { usePdfInteractions } from './usePdfInteractions'
import type { Shape, Tool } from '../../../types'

function setup(tool: Tool, shapes: Shape[] = [], stampImage?: string) {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000, x: 0, y: 0, toJSON: () => ({}) })
    const actions = { pushOverlay: vi.fn(), updateShape: vi.fn(), removeShape: vi.fn(), snapshot: vi.fn(), setZoom: vi.fn() }
    const hook = renderHook(() =>
        usePdfInteractions({
            canvasRef: { current: canvas },
            wrapperRef: { current: document.createElement('div') },
            textAreaRef: { current: null },
            tool,
            pageId: 'p1',
            shapes,
            stampImage,
            textSettings: { fontFamily: 'Helvetica', fontSize: 14 },
            zoom: 1,
            activeColor: '#ef4444',
            strokeWidth: 0.003,
            actions,
        })
    )
    const pointer = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', target: canvas, preventDefault: vi.fn() }) as unknown as ReactPointerEvent
    return { hook, actions, pointer }
}

describe('usePdfInteractions', () => {
    it('draws with the pen and commits one shape in normalized coordinates', () => {
        const { hook, actions, pointer } = setup('pen')
        act(() => hook.result.current.handlers.onPointerDown(pointer(100, 100)))
        expect(hook.result.current.mode).toBe('drawing')
        act(() => hook.result.current.handlers.onPointerMove(pointer(200, 300)))
        act(() => hook.result.current.handlers.onPointerUp(pointer(200, 300)))

        expect(actions.pushOverlay).toHaveBeenCalledWith('p1', { type: 'pen', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.3 }], width: 0.003, color: '#ef4444' })
        expect(hook.result.current.mode).toBe('idle')
    })

    it('places checkboxes and stamps with a single click', () => {
        const checkbox = setup('checkbox')
        act(() => checkbox.hook.result.current.handlers.onPointerDown(checkbox.pointer(500, 500)))
        expect(checkbox.actions.pushOverlay).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'checkbox', x: 0.5, y: 0.5 }))

        const stamp = setup('stamp', [], 'data:image/png;base64,AA==')
        act(() => stamp.hook.result.current.handlers.onPointerDown(stamp.pointer(0, 0)))
        expect(stamp.actions.pushOverlay).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'stamp' }))

        const noStamp = setup('stamp')
        act(() => noStamp.hook.result.current.handlers.onPointerDown(noStamp.pointer(0, 0)))
        expect(noStamp.actions.pushOverlay).not.toHaveBeenCalled()
    })

    it('inserts a text box and starts editing', () => {
        const { hook, actions, pointer } = setup('text')
        const down = pointer(100, 100)
        act(() => hook.result.current.handlers.onPointerDown(down))
        expect(actions.pushOverlay).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'text', x: 0.1, y: 0.1 }))
        // Prevents the browser from moving focus away from the new (still empty) text box.
        expect(down.preventDefault).toHaveBeenCalled()
        expect(hook.result.current.editing).toEqual({ pageId: 'p1', index: 0 })
    })

    it('drags a selected shape with the select tool', () => {
        const shape: Shape = { type: 'highlight', x: 0.1, y: 0.1, w: 0.2, h: 0.2, opacity: 0.35 }
        const { hook, actions, pointer } = setup('select', [shape])
        act(() => hook.result.current.handlers.onPointerDown(pointer(200, 200)))
        expect(hook.result.current.mode).toBe('dragging')
        act(() => hook.result.current.handlers.onPointerMove(pointer(300, 200)))
        act(() => hook.result.current.handlers.onPointerUp(pointer(300, 200)))
        expect(actions.snapshot).toHaveBeenCalledOnce()
        expect(actions.updateShape).toHaveBeenCalledWith('p1', 0, expect.objectContaining({ x: expect.closeTo(0.2) }), { record: false })
    })

    it('zooms with ctrl+wheel only', () => {
        const { hook, actions } = setup('select')
        const preventDefault = vi.fn()
        act(() => hook.result.current.handlers.onWheel({ ctrlKey: false, metaKey: false, deltaY: -1, preventDefault } as unknown as WheelEvent))
        expect(actions.setZoom).not.toHaveBeenCalled()
        act(() => hook.result.current.handlers.onWheel({ ctrlKey: true, metaKey: false, deltaY: -1, preventDefault } as unknown as WheelEvent))
        expect(actions.setZoom).toHaveBeenCalledWith(1.08)
        expect(preventDefault).toHaveBeenCalled()
    })

    it('opens a text box for editing on double click', () => {
        const text: Shape = { type: 'text', x: 0.1, y: 0.1, w: 0.3, h: 0.1, text: 'Hallo', fontSize: 12, fontFamily: 'Helvetica' }
        const { hook, actions } = setup('select', [text])
        act(() => hook.result.current.handlers.onDoubleClick({ clientX: 200, clientY: 150 } as unknown as React.MouseEvent))
        expect(actions.snapshot).toHaveBeenCalled()
        expect(hook.result.current.editing).toEqual({ pageId: 'p1', index: 0 })
        expect(hook.result.current.editingValue).toBe('Hallo')
    })
})
