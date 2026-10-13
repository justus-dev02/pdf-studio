import { useShallow } from 'zustand/react/shallow'
import type { PageRef, Shape } from '../types'
import { useDoc } from './docStore'
import type { DocActions } from './docStore'

export { useDoc, getDefaultTextShape, createPageId, pagesForSource, HISTORY_LIMIT, ZOOM_MIN, ZOOM_MAX, FONT_SIZE_MIN, FONT_SIZE_MAX } from './docStore'
export type { DocStore, DocActions, TextSettings, HistoryEntry, ChangeOptions } from './docStore'

/**
 * Narrow selector hooks. Components subscribe only to the slice they render, so e.g.
 * dragging a shape (overlay updates on every pointer move) no longer re-renders the
 * toolbar or the thumbnail list.
 */
export const useDocActions = (): DocActions => useDoc((s) => s.actions)

const EMPTY_SHAPES: Shape[] = []

export function useActivePage(): { page: PageRef | undefined; index: number; count: number } {
    return useDoc(
        useShallow((s) => {
            const count = s.document.pages.length
            const index = Math.max(0, Math.min(s.viewer.activePage, count - 1))
            return { page: s.document.pages[index], index, count }
        })
    )
}

export const usePageShapes = (pageId: string | undefined): Shape[] =>
    useDoc((s) => (pageId ? s.document.overlays[pageId] : undefined) ?? EMPTY_SHAPES)

export const useHasDocument = (): boolean => useDoc((s) => s.document.pages.length > 0)

export const useCanUndoRedo = () =>
    useDoc(useShallow((s) => ({ canUndo: s.history.undo.length > 0, canRedo: s.history.redo.length > 0 })))
