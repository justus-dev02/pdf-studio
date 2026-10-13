import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { PageId, Shape } from '../../../types'
import type { ChangeOptions, TextSettings } from '../../../store'
import { getDefaultTextShape } from '../../../store'
import { clamp } from '../../../lib/geometry'
import type { InteractionMode, TextEditingState } from './interactionTypes'

type UsePdfTextEditingArgs = {
    canvasRef: RefObject<HTMLCanvasElement>
    textAreaRef: RefObject<HTMLTextAreaElement>
    pageId: PageId | undefined
    shapes: Shape[]
    onSelectIndex: (index: number | null) => void
    onModeChange: (mode: InteractionMode) => void
    actions: {
        pushOverlay: (pageId: PageId, shape: Shape, options?: ChangeOptions) => void
        updateShape: (pageId: PageId, shapeIndex: number, next: Shape, options?: ChangeOptions) => void
        removeShape: (pageId: PageId, shapeIndex: number, options?: ChangeOptions) => void
        snapshot: () => void
    }
}

const MIN_SIZE = 0.02

export function usePdfTextEditing({ canvasRef, textAreaRef, pageId, shapes, onSelectIndex, onModeChange, actions }: UsePdfTextEditingArgs) {
    const [editing, setEditing] = useState<TextEditingState | null>(null)
    const [editingValue, setEditingValue] = useState('')

    const commitTextEdit = useCallback(() => {
        if (!editing) return
        const shape = editing.pageId === pageId ? shapes[editing.index] : undefined
        setEditing(null)
        setEditingValue('')
        if (!shape || shape.type !== 'text') return

        if (editingValue.trim().length === 0) {
            // The insert (or edit start) already wrote the undo entry; removing the empty box must not add another.
            actions.removeShape(editing.pageId, editing.index, { record: false })
            onSelectIndex(null)
            return
        }

        let { x, y, w, h } = shape
        const canvas = canvasRef.current
        const area = textAreaRef.current
        if (canvas && area) {
            // The textarea is user-resizable; persist its final size.
            const rect = canvas.getBoundingClientRect()
            const areaRect = area.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && areaRect.width > 0) {
                x = clamp((areaRect.left - rect.left) / rect.width, 0, 1)
                y = clamp((areaRect.top - rect.top) / rect.height, 0, 1)
                w = clamp(areaRect.width / rect.width, MIN_SIZE, 1)
                h = clamp(areaRect.height / rect.height, MIN_SIZE, 1)
            }
        }
        actions.updateShape(editing.pageId, editing.index, { ...shape, x, y, w, h, text: editingValue }, { record: false })
        onSelectIndex(editing.index)
    }, [editing, pageId, shapes, editingValue, canvasRef, textAreaRef, actions, onSelectIndex])

    useEffect(() => {
        if (!editing) return
        textAreaRef.current?.focus()
        textAreaRef.current?.select()
    }, [editing, textAreaRef])

    // Leaving the page while typing commits the text.
    useEffect(() => {
        if (editing && editing.pageId !== pageId) {
            const timer = setTimeout(commitTextEdit, 0)
            return () => clearTimeout(timer)
        }
        return undefined
    }, [pageId, editing, commitTextEdit])

    const beginTextEdit = (index: number) => {
        const shape = shapes[index]
        if (!pageId || !shape || shape.type !== 'text') return
        actions.snapshot()
        setEditing({ pageId, index })
        setEditingValue(shape.text)
        onSelectIndex(index)
        onModeChange('idle')
    }

    const beginTextInsert = (x: number, y: number, textSettings: TextSettings, color?: string) => {
        if (!pageId) return
        const index = shapes.length
        const shape = getDefaultTextShape(textSettings, color)
        actions.pushOverlay(pageId, { ...shape, x: clamp(x, 0, 1 - shape.w), y: clamp(y, 0, 1 - shape.h) })
        setEditing({ pageId, index })
        setEditingValue('')
        onSelectIndex(index)
        onModeChange('idle')
    }

    return { editing, editingValue, setEditingValue, beginTextEdit, beginTextInsert, commitTextEdit }
}
