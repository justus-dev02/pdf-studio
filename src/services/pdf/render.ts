import type { PageRef, PaperDimensions } from '../../types'
import { PAPER_PRESETS } from '../../types'
import { getPdfDocument } from './documentCache'
import { normalizePdfJsError, PdfError, throwIfAborted } from './errors'

/** Page size in PDF points at scale 1. */
export type PageSize = PaperDimensions

export type RenderOptions = {
    /** CSS zoom factor (1 = 72 dpi). */
    zoom: number
    /** Device pixel ratio for crisp output on HiDPI screens. Defaults to window.devicePixelRatio. */
    pixelRatio?: number
    signal?: AbortSignal
    /** Set the canvas CSS size to `size * zoom` (default). Disable when CSS controls the size, e.g. thumbnails. */
    applyCssSize?: boolean
}

/** Canvas backing stores above ~16k px or ~268 MP fail silently in several browsers. */
const MAX_CANVAS_DIMENSION = 8192

export const blankPageSize = (page: Extract<PageRef, { kind: 'blank' }>): PageSize =>
    page.customDimensions ?? PAPER_PRESETS[page.format]

/**
 * Renders a page into the given canvas and returns its size in PDF points.
 * The canvas CSS size equals `size * zoom`; the backing store is scaled by the pixel ratio.
 */
export async function renderPage(page: PageRef, canvas: HTMLCanvasElement, options: RenderOptions): Promise<PageSize> {
    const { zoom, signal } = options
    const pixelRatio = options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    throwIfAborted(signal)

    if (page.kind === 'blank') {
        const size = blankPageSize(page)
        const scale = clampScale(size, zoom * pixelRatio)
        sizeCanvas(canvas, size, zoom, scale, options.applyCssSize ?? true)
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        return size
    }

    const doc = await getPdfDocument(page.sourceKey)
    throwIfAborted(signal)
    if (page.index < 0 || page.index >= doc.numPages) {
        throw new PdfError('page-out-of-range', `Page ${page.index + 1} of ${doc.numPages}`)
    }

    const pdfPage = await doc.getPage(page.index + 1)
    throwIfAborted(signal)
    const base = pdfPage.getViewport({ scale: 1 })
    const size: PageSize = { width: base.width, height: base.height }
    const scale = clampScale(size, zoom * pixelRatio)
    const viewport = pdfPage.getViewport({ scale })

    // Render into an offscreen canvas first, so a cancelled or failed render never
    // leaves a half-painted page and the visible canvas is resized only once.
    const buffer = document.createElement('canvas')
    buffer.width = Math.floor(viewport.width)
    buffer.height = Math.floor(viewport.height)
    const bufferCtx = buffer.getContext('2d')
    if (!bufferCtx) throw new PdfError('invalid-pdf', 'Canvas 2D context unavailable')
    bufferCtx.fillStyle = '#ffffff'
    bufferCtx.fillRect(0, 0, buffer.width, buffer.height)

    const task = pdfPage.render({ canvasContext: bufferCtx, viewport, intent: 'display' })
    const onAbort = () => task.cancel()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
        await task.promise
    } catch (error) {
        throw normalizePdfJsError(error)
    } finally {
        signal?.removeEventListener('abort', onAbort)
        // Frees operator lists and decoded images of this page; returns false while other renders are in flight.
        pdfPage.cleanup()
    }
    throwIfAborted(signal)

    sizeCanvas(canvas, size, zoom, scale, options.applyCssSize ?? true)
    canvas.getContext('2d')?.drawImage(buffer, 0, 0)
    buffer.width = 0
    buffer.height = 0
    return size
}

function clampScale(size: PageSize, scale: number): number {
    const largest = Math.max(size.width, size.height) * scale
    return largest > MAX_CANVAS_DIMENSION ? (MAX_CANVAS_DIMENSION / Math.max(size.width, size.height)) : scale
}

function sizeCanvas(canvas: HTMLCanvasElement, size: PageSize, zoom: number, scale: number, applyCssSize: boolean) {
    canvas.width = Math.floor(size.width * scale)
    canvas.height = Math.floor(size.height * scale)
    if (applyCssSize) {
        canvas.style.width = `${Math.floor(size.width * zoom)}px`
        canvas.style.height = `${Math.floor(size.height * zoom)}px`
    }
}
