import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { isCancelled, renderPage } from '../../../services/pdf'
import type { PageSize } from '../../../services/pdf'
import type { PageRef } from '../../../types'

type UsePdfRendererArgs = {
    canvasRef: RefObject<HTMLCanvasElement>
    page?: PageRef
    zoom: number
    /** Delay for re-renders of the same page (zoom changes); the first render of a page is immediate. */
    zoomDebounceMs?: number
}

export type RenderState = {
    pageSize: PageSize | null
    error: unknown
    isRendering: boolean
}

/**
 * Renders the given page into the canvas. A newer render (other page or zoom) aborts the
 * previous one, so fast page flipping never paints a stale page or piles up pdf.js work.
 */
export function usePdfRenderer({ canvasRef, page, zoom, zoomDebounceMs = 120 }: UsePdfRendererArgs): RenderState {
    const [state, setState] = useState<RenderState>({ pageSize: null, error: null, isRendering: false })
    const [renderedPageId, setRenderedPageId] = useState<string | null>(null)
    const isSamePage = page?.id === renderedPageId

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !page) return

        const controller = new AbortController()
        const run = () => {
            setState((prev) => ({ ...prev, isRendering: true }))
            renderPage(page, canvas, { zoom, signal: controller.signal })
                .then((pageSize) => {
                    if (controller.signal.aborted) return
                    setRenderedPageId(page.id)
                    setState({ pageSize, error: null, isRendering: false })
                })
                .catch((error: unknown) => {
                    if (controller.signal.aborted || isCancelled(error)) return
                    setState({ pageSize: null, error, isRendering: false })
                })
        }

        const timer = isSamePage ? setTimeout(run, zoomDebounceMs) : null
        if (!timer) run()

        return () => {
            if (timer) clearTimeout(timer)
            controller.abort()
        }
        // `isSamePage` only decides debouncing; it must not trigger renders by itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasRef, page, zoom, zoomDebounceMs])

    return state
}
