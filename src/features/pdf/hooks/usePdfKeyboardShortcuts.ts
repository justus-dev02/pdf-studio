import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export type KeyboardShortcutHandlers = {
    pagesCount: number
    activePage: number
    shapesCount: number
    selectedIndex: number | null
    editing: boolean
    setActivePage: (index: number) => void
    selectShape: (index: number | null) => void
    moveSelection: (dx: number, dy: number) => void
    deleteSelection: () => void
    editSelection: () => void
    commitEdit: () => void
}

/** Normalized step for arrow-key moves; Shift moves ten times as far. */
export const KEYBOARD_STEP = 0.005

export const isTypingTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null
    if (!el) return false
    const tag = el.tagName?.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true
}

/**
 * Keyboard access to the page and its annotations:
 *  PageUp/PageDown (and ←/→ without selection) change page,
 *  [ / ] cycle through annotations, arrows move the selection, Delete removes it,
 *  Enter edits a text box, Escape clears the selection or ends text editing.
 *
 * Shortcuts are scoped to `scopeRef` (the viewer) so they never fight with the toolbar or dialogs.
 */
export function usePdfKeyboardShortcuts(scopeRef: RefObject<HTMLElement>, handlers: KeyboardShortcutHandlers) {
    const latest = useRef(handlers)
    latest.current = handlers

    useEffect(() => {
        const scope = scopeRef.current
        if (!scope) return

        const onKey = (e: KeyboardEvent) => {
            const h = latest.current
            if (h.editing) {
                if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                    e.preventDefault()
                    h.commitEdit()
                }
                return
            }
            if (isTypingTarget(e.target) || e.altKey || e.metaKey || e.ctrlKey) return

            const step = e.shiftKey ? KEYBOARD_STEP * 10 : KEYBOARD_STEP
            const hasSelection = h.selectedIndex !== null

            switch (e.key) {
                case 'PageDown':
                    h.setActivePage(Math.min(h.activePage + 1, h.pagesCount - 1))
                    break
                case 'PageUp':
                    h.setActivePage(Math.max(h.activePage - 1, 0))
                    break
                case ']':
                    if (h.shapesCount === 0) return
                    h.selectShape(hasSelection ? (h.selectedIndex! + 1) % h.shapesCount : 0)
                    break
                case '[':
                    if (h.shapesCount === 0) return
                    h.selectShape(hasSelection ? (h.selectedIndex! - 1 + h.shapesCount) % h.shapesCount : h.shapesCount - 1)
                    break
                case 'ArrowLeft':
                    if (hasSelection) h.moveSelection(-step, 0)
                    else h.setActivePage(Math.max(h.activePage - 1, 0))
                    break
                case 'ArrowRight':
                    if (hasSelection) h.moveSelection(step, 0)
                    else h.setActivePage(Math.min(h.activePage + 1, h.pagesCount - 1))
                    break
                case 'ArrowUp':
                    if (!hasSelection) return
                    h.moveSelection(0, -step)
                    break
                case 'ArrowDown':
                    if (!hasSelection) return
                    h.moveSelection(0, step)
                    break
                case 'Delete':
                case 'Backspace':
                    if (!hasSelection) return
                    h.deleteSelection()
                    break
                case 'Enter':
                    if (!hasSelection) return
                    h.editSelection()
                    break
                case 'Escape':
                    if (!hasSelection) return
                    h.selectShape(null)
                    break
                default:
                    return
            }
            e.preventDefault()
        }

        scope.addEventListener('keydown', onKey)
        return () => scope.removeEventListener('keydown', onKey)
    }, [scopeRef])
}
