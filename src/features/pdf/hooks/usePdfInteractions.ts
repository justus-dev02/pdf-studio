import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from 'react'
import type { PageId, Shape, Tool } from '../../../types'
import type { ChangeOptions, TextSettings } from '../../../store'
import { clamp } from '../../../lib/geometry'
import { hitTestIndex } from '../../../lib/shapes'
import { usePdfDrawingInteractions } from './usePdfDrawingInteractions'
import { usePdfPanInteractions } from './usePdfPanInteractions'
import { usePdfPinchZoom } from './usePdfPinchZoom'
import { usePdfSelectionInteractions } from './usePdfSelectionInteractions'
import { usePdfTextEditing } from './usePdfTextEditing'
import type { InteractionMode } from './interactionTypes'

export type InteractionActions = {
    pushOverlay: (pageId: PageId, shape: Shape, options?: ChangeOptions) => void
    updateShape: (pageId: PageId, shapeIndex: number, next: Shape, options?: ChangeOptions) => void
    removeShape: (pageId: PageId, shapeIndex: number, options?: ChangeOptions) => void
    snapshot: () => void
    setZoom: (zoom: number) => void
}

type UsePdfInteractionsArgs = {
    canvasRef: RefObject<HTMLCanvasElement>
    wrapperRef: RefObject<HTMLDivElement>
    textAreaRef: RefObject<HTMLTextAreaElement>
    tool: Tool
    pageId: PageId | undefined
    shapes: Shape[]
    stampImage?: string
    textSettings: TextSettings
    zoom: number
    activeColor?: string
    strokeWidth?: number
    actions: InteractionActions
}

const WHEEL_ZOOM_STEP = 1.08

/** Composes the pointer interactions of the page canvas into one set of event handlers. */
export function usePdfInteractions({
    canvasRef,
    wrapperRef,
    textAreaRef,
    tool,
    pageId,
    shapes,
    stampImage,
    textSettings,
    zoom,
    activeColor,
    strokeWidth,
    actions,
}: UsePdfInteractionsArgs) {
    const [isDown, setDown] = useState(false)
    const [startPx, setStartPx] = useState<{ x: number; y: number } | null>(null)
    const [mode, setMode] = useState<InteractionMode>('idle')

    const selection = usePdfSelectionInteractions({ pageId, shapes, actions })
    const drawing = usePdfDrawingInteractions({
        pageId,
        shapeCount: shapes.length,
        activeColor,
        strokeWidth,
        actions,
        onSelectIndex: selection.setSelectedIndex,
    })
    const pan = usePdfPanInteractions({ wrapperRef })
    const pinch = usePdfPinchZoom({ zoom, setZoom: actions.setZoom, setMode })
    const textEditing = usePdfTextEditing({
        canvasRef,
        textAreaRef,
        pageId,
        shapes,
        onSelectIndex: selection.setSelectedIndex,
        onModeChange: setMode,
        actions,
    })

    const toCanvasPoint = (e: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return null
        const x = clamp(e.clientX - rect.left, 0, rect.width)
        const y = clamp(e.clientY - rect.top, 0, rect.height)
        return { px: { x, y }, norm: { x: x / rect.width, y: y / rect.height } }
    }

    const finish = () => {
        setDown(false)
        setStartPx(null)
        setMode('idle')
        pan.resetPan()
        selection.resetInteraction()
    }

    const onPointerDown = (e: ReactPointerEvent) => {
        const point = toCanvasPoint(e)
        if (!point || !pageId) return
        if (pinch.onPointerDown(e)) return
        if (textEditing.editing) textEditing.commitTextEdit()

        if (tool === 'text-select') {
            selection.setSelectedIndex(null)
            return
        }

        setDown(true)
        setStartPx(point.px)

        if (tool === 'pan' || tool === 'select') {
            const { nextMode } = selection.beginSelection(point.norm)
            if (nextMode !== 'idle') {
                setMode(nextMode)
                ;(e.target as Element).setPointerCapture?.(e.pointerId)
                return
            }
            if (tool === 'pan') {
                setMode('panning')
                pan.beginPan()
                ;(e.target as Element).setPointerCapture?.(e.pointerId)
            }
            return
        }

        if (tool === 'text') {
            // Without this the browser's default mousedown focus handling moves focus to the viewer,
            // which blurs (and thereby discards) the freshly inserted, still empty text box.
            e.preventDefault()
            textEditing.beginTextInsert(point.norm.x, point.norm.y, textSettings)
            setDown(false)
            return
        }

        if (tool === 'checkbox') {
            actions.pushOverlay(pageId, { type: 'checkbox', x: point.norm.x, y: point.norm.y, size: 0.03, checked: true, color: activeColor })
            selection.setSelectedIndex(shapes.length)
            setDown(false)
            return
        }

        if (tool === 'stamp') {
            if (stampImage) {
                actions.pushOverlay(pageId, { type: 'stamp', x: point.norm.x, y: point.norm.y, w: 0.28, h: 0.1, imageDataUrl: stampImage })
                selection.setSelectedIndex(shapes.length)
            }
            setDown(false)
            return
        }

        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        setMode('drawing')
        drawing.beginDrawing(tool, point.norm)
    }

    const onPointerMove = (e: ReactPointerEvent) => {
        if (pinch.onPointerMove(e)) return
        if (!isDown) return
        const point = toCanvasPoint(e)
        if (!point) return

        if (mode === 'panning' && startPx) pan.updatePan(startPx, point.px)
        else if (mode === 'dragging') selection.updateDrag(point.norm)
        else if (mode === 'resizing') selection.updateResize(point.norm)
        else if (mode === 'drawing') drawing.updateDrawing(tool, point.norm)
    }

    const onPointerUp = (e: ReactPointerEvent) => {
        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        if (pinch.onPointerUp(e)) return
        if (!isDown) return
        if (mode === 'drawing') drawing.commitDrawing()
        finish()
    }

    const onPointerCancel = (e: ReactPointerEvent) => {
        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        if (pinch.onPointerCancel(e)) return
        drawing.clearDrawing()
        finish()
    }

    const onDoubleClick = (e: ReactMouseEvent) => {
        if (tool !== 'select' && tool !== 'pan') return
        const point = toCanvasPoint(e)
        if (!point) return
        const hit = hitTestIndex(shapes, point.norm.x, point.norm.y)
        if (hit !== null && shapes[hit].type === 'text') textEditing.beginTextEdit(hit)
    }

    /** Attach as a non-passive native listener: React registers wheel handlers as passive, so preventDefault would be ignored. */
    const onWheel = (e: WheelEvent | ReactWheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        actions.setZoom(e.deltaY < 0 ? zoom * WHEEL_ZOOM_STEP : zoom / WHEEL_ZOOM_STEP)
    }

    return {
        mode,
        tempShape: drawing.tempShape,
        selectedIndex: selection.selectedIndex,
        setSelectedIndex: selection.setSelectedIndex,
        editing: textEditing.editing,
        editingValue: textEditing.editingValue,
        setEditingValue: textEditing.setEditingValue,
        beginTextEdit: textEditing.beginTextEdit,
        commitTextEdit: textEditing.commitTextEdit,
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick, onWheel },
    }
}
