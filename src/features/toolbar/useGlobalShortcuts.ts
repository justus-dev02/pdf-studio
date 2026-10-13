import { useEffect, useRef } from 'react'
import { useDoc } from '../../store'
import { isTypingTarget } from '../pdf/hooks/usePdfKeyboardShortcuts'

export type GlobalShortcutHandlers = {
    openSearch: () => void
    openFile: () => void
    exportDocument: () => void
}

const ZOOM_STEP = 1.1

/**
 * Application-wide shortcuts (Ctrl on Windows/Linux, Cmd on macOS):
 *  F search · O open · S export · Z undo · Shift+Z / Y redo · +/- zoom.
 * Undo/redo is left to the browser while a text field has focus.
 * Shortcuts are suspended while a modal dialog is open.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
    const latest = useRef(handlers)
    latest.current = handlers

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return
            if (document.querySelector('[aria-modal="true"]')) return
            const { actions, viewer } = useDoc.getState()
            const key = e.key.toLowerCase()

            if (key === 'f') latest.current.openSearch()
            else if (key === 'o') latest.current.openFile()
            else if (key === 's') latest.current.exportDocument()
            else if ((key === 'z' || key === 'y') && isTypingTarget(e.target)) return
            else if (key === 'z' && !e.shiftKey) actions.undo()
            else if ((key === 'z' && e.shiftKey) || key === 'y') actions.redo()
            else if (key === '+' || key === '=') actions.setZoom(viewer.zoom * ZOOM_STEP)
            else if (key === '-') actions.setZoom(viewer.zoom / ZOOM_STEP)
            else return
            e.preventDefault()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])
}
