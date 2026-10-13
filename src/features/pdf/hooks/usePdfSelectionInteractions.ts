import { useRef, useState } from 'react'
import type { PageId, Shape } from '../../../types'
import type { ChangeOptions } from '../../../store'
import { distance } from '../../../lib/geometry'
import { getBBox, hitTestIndex, resizeShape, translateShape } from '../../../lib/shapes'
import type { BBox } from '../../../lib/shapes'
import type { InteractionMode, ResizeHandle } from './interactionTypes'

type Point = { x: number; y: number }

type UsePdfSelectionInteractionsArgs = {
    pageId: PageId | undefined
    shapes: Shape[]
    actions: {
        updateShape: (pageId: PageId, shapeIndex: number, next: Shape, options?: ChangeOptions) => void
        snapshot: () => void
    }
}

const HANDLE_RADIUS = 0.018
const MIN_SIZE = 0.02

type Gesture = {
    start: Point
    origin: Shape
    handle: ResizeHandle | null
    originBox: BBox
    /** The undo entry is written on the first real movement, so a plain click creates no history entry. */
    recorded: boolean
}

export function usePdfSelectionInteractions({ pageId, shapes, actions }: UsePdfSelectionInteractionsArgs) {
    const [selection, setSelection] = useState<{ pageId: PageId; index: number } | null>(null)
    const gesture = useRef<Gesture | null>(null)

    // Selection belongs to a page; switching pages (or deleting the shape) clears it implicitly.
    const selectedIndex = selection && selection.pageId === pageId && selection.index < shapes.length ? selection.index : null

    const setSelectedIndex = (index: number | null) => {
        setSelection(index === null || !pageId ? null : { pageId, index })
    }

    const handleAt = (shape: Shape, point: Point): ResizeHandle | null => {
        const bb = getBBox(shape)
        const handles: Record<ResizeHandle, Point> = {
            nw: { x: bb.x, y: bb.y },
            ne: { x: bb.x + bb.w, y: bb.y },
            sw: { x: bb.x, y: bb.y + bb.h },
            se: { x: bb.x + bb.w, y: bb.y + bb.h },
        }
        for (const [key, handlePoint] of Object.entries(handles) as [ResizeHandle, Point][]) {
            if (distance(handlePoint, point) <= HANDLE_RADIUS) return key
        }
        return null
    }

    const beginSelection = (point: Point): { nextMode: InteractionMode } => {
        // Handles of the already selected shape win over shapes stacked above it.
        const current = selectedIndex !== null ? shapes[selectedIndex] : null
        const currentHandle = current ? handleAt(current, point) : null
        const hit = currentHandle ? selectedIndex : hitTestIndex(shapes, point.x, point.y)
        if (hit === null) {
            setSelectedIndex(null)
            gesture.current = null
            return { nextMode: 'idle' }
        }
        const shape = shapes[hit]
        const handle = currentHandle ?? handleAt(shape, point)
        setSelectedIndex(hit)
        gesture.current = { start: point, origin: shape, handle, originBox: getBBox(shape), recorded: false }
        return { nextMode: handle ? 'resizing' : 'dragging' }
    }

    const apply = (next: Shape) => {
        const g = gesture.current
        if (!g || selectedIndex === null || !pageId) return false
        if (!g.recorded) {
            actions.snapshot()
            g.recorded = true
        }
        actions.updateShape(pageId, selectedIndex, next, { record: false })
        return true
    }

    const updateDrag = (point: Point): boolean => {
        const g = gesture.current
        if (!g) return false
        return apply(translateShape(g.origin, point.x - g.start.x, point.y - g.start.y))
    }

    const updateResize = (point: Point): boolean => {
        const g = gesture.current
        if (!g || !g.handle) return false
        const dx = point.x - g.start.x
        const dy = point.y - g.start.y
        let left = g.originBox.x
        let top = g.originBox.y
        let right = g.originBox.x + g.originBox.w
        let bottom = g.originBox.y + g.originBox.h

        if (g.handle.includes('w')) left = Math.min(Math.max(left + dx, 0), right - MIN_SIZE)
        if (g.handle.includes('e')) right = Math.min(Math.max(right + dx, left + MIN_SIZE), 1)
        if (g.handle.includes('n')) top = Math.min(Math.max(top + dy, 0), bottom - MIN_SIZE)
        if (g.handle.includes('s')) bottom = Math.min(Math.max(bottom + dy, top + MIN_SIZE), 1)

        return apply(resizeShape(g.origin, g.originBox, { x: left, y: top, w: right - left, h: bottom - top }))
    }

    const resetInteraction = () => {
        gesture.current = null
    }

    return { selectedIndex, setSelectedIndex, beginSelection, updateDrag, updateResize, resetInteraction }
}
