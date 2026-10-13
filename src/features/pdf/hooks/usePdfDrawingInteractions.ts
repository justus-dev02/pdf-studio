import { useState } from 'react'
import type { PageId, Shape, Tool } from '../../../types'

type Point = { x: number; y: number }

type UsePdfDrawingInteractionsArgs = {
    pageId: PageId | undefined
    shapeCount: number
    activeColor?: string
    strokeWidth?: number
    actions: { pushOverlay: (pageId: PageId, shape: Shape) => void }
    onSelectIndex: (index: number | null) => void
}

const MIN_SIZE = 0.01
/** Skip pen points closer than this (normalized) to the previous one; keeps paths small on high-rate pointer devices. */
const MIN_POINT_DISTANCE = 0.002

export function usePdfDrawingInteractions({
    pageId,
    shapeCount,
    activeColor = '#eab308',
    strokeWidth = 0.003,
    actions,
    onSelectIndex,
}: UsePdfDrawingInteractionsArgs) {
    const [tempShape, setTempShape] = useState<Shape | null>(null)
    const [start, setStart] = useState<Point | null>(null)

    const beginDrawing = (tool: Tool, point: Point) => {
        setStart(point)
        if (tool === 'pen') setTempShape({ type: 'pen', points: [point], width: strokeWidth, color: activeColor })
        if (tool === 'highlight') setTempShape({ type: 'highlight', x: point.x, y: point.y, w: 0, h: 0, opacity: 0.35, color: activeColor })
    }

    const updateDrawing = (tool: Tool, point: Point) => {
        if (tool === 'highlight' && start) {
            setTempShape({
                type: 'highlight',
                x: Math.min(start.x, point.x),
                y: Math.min(start.y, point.y),
                w: Math.abs(point.x - start.x),
                h: Math.abs(point.y - start.y),
                opacity: 0.35,
                color: activeColor,
            })
        }
        if (tool === 'pen') {
            setTempShape((prev) => {
                if (!prev || prev.type !== 'pen') return prev
                const last = prev.points[prev.points.length - 1]
                if (last && Math.hypot(last.x - point.x, last.y - point.y) < MIN_POINT_DISTANCE) return prev
                return { ...prev, points: [...prev.points, point] }
            })
        }
    }

    const commitDrawing = () => {
        const shape = tempShape
        setTempShape(null)
        setStart(null)
        if (!shape || !pageId) return
        if (shape.type === 'highlight' && (shape.w < MIN_SIZE || shape.h < MIN_SIZE)) return
        if (shape.type === 'pen' && shape.points.length < 2) return
        actions.pushOverlay(pageId, shape)
        onSelectIndex(shapeCount)
    }

    const clearDrawing = () => {
        setTempShape(null)
        setStart(null)
    }

    return { tempShape, beginDrawing, updateDrawing, commitDrawing, clearDrawing }
}
