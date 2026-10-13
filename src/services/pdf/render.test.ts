import { afterEach, describe, expect, it, vi } from 'vitest'
import { openTestPdf } from '../../test/pdfFixtures'
import { evictPdfDocument, getPdfDocument, isPdfDocumentCached } from './documentCache'
import { isPdfError } from './errors'
import { renderPage } from './render'

/** jsdom has no canvas backend; a recording 2D context is enough to verify sizing and the pdf.js call. */
function stubCanvasContext() {
    const ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as CanvasRenderingContext2D)
    return ctx
}

afterEach(() => vi.restoreAllMocks())

describe('renderPage', () => {
    it('sizes blank pages in PDF points times zoom and device pixel ratio', async () => {
        stubCanvasContext()
        const canvas = document.createElement('canvas')
        const size = await renderPage({ id: 'b', kind: 'blank', format: 'Letter' }, canvas, { zoom: 1.5, pixelRatio: 2 })

        expect(size).toEqual({ width: 612, height: 792 })
        expect(canvas.width).toBe(Math.floor(612 * 3))
        expect(canvas.style.width).toBe(`${Math.floor(612 * 1.5)}px`)
    })

    it('caps the backing store for extreme zoom levels', async () => {
        stubCanvasContext()
        const canvas = document.createElement('canvas')
        await renderPage({ id: 'b', kind: 'blank', format: 'A3' }, canvas, { zoom: 6, pixelRatio: 3 })
        expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(8192)
    })

    it('leaves CSS sizing to the caller when requested (thumbnails)', async () => {
        stubCanvasContext()
        const canvas = document.createElement('canvas')
        await renderPage({ id: 'b', kind: 'blank', format: 'A4' }, canvas, { zoom: 0.3, pixelRatio: 1, applyCssSize: false })
        expect(canvas.style.width).toBe('')
    })

    it('renders PDF pages through pdf.js into an offscreen buffer', async () => {
        const ctx = stubCanvasContext()
        const { pages } = await openTestPdf([{ width: 400, height: 300 }])
        const doc = await getPdfDocument(pages[0].sourceKey)
        const page = await doc.getPage(1)
        const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
        vi.spyOn(doc, 'getPage').mockResolvedValue(Object.assign(page, { render }) as typeof page)

        const canvas = document.createElement('canvas')
        const size = await renderPage(pages[0], canvas, { zoom: 2, pixelRatio: 1 })

        expect(size).toEqual({ width: 400, height: 300 })
        expect(render).toHaveBeenCalledOnce()
        expect(canvas.width).toBe(800)
        expect(ctx.drawImage).toHaveBeenCalledOnce()
    })

    it('cancels the pdf.js render task when aborted', async () => {
        stubCanvasContext()
        const { pages } = await openTestPdf([{}])
        const doc = await getPdfDocument(pages[0].sourceKey)
        const page = await doc.getPage(1)
        const controller = new AbortController()
        const cancel = vi.fn()
        let reject: (reason: unknown) => void = () => undefined
        const render = vi.fn(() => ({
            promise: new Promise<void>((_, r) => {
                reject = r
            }),
            cancel: () => {
                cancel()
                reject({ name: 'RenderingCancelledException' })
            },
        }))
        vi.spyOn(doc, 'getPage').mockResolvedValue(Object.assign(page, { render }) as typeof page)

        const pending = renderPage(pages[0], document.createElement('canvas'), { zoom: 1, signal: controller.signal })
        await vi.waitFor(() => expect(render).toHaveBeenCalled())
        controller.abort()
        const error = await pending.catch((e: unknown) => e)
        expect(cancel).toHaveBeenCalled()
        expect(isPdfError(error, 'cancelled')).toBe(true)
    })

    it('fails fast for an already aborted signal and for missing pages', async () => {
        const { pages, source } = await openTestPdf([{}])
        const controller = new AbortController()
        controller.abort()
        expect(isPdfError(await renderPage(pages[0], document.createElement('canvas'), { zoom: 1, signal: controller.signal }).catch((e: unknown) => e), 'cancelled')).toBe(true)
        const missing = await renderPage({ id: 'x', kind: 'pdf', sourceKey: source.key, index: 9 }, document.createElement('canvas'), { zoom: 1 }).catch((e: unknown) => e)
        expect(isPdfError(missing, 'page-out-of-range')).toBe(true)
    })
})

describe('document cache eviction', () => {
    it('destroys the pdf.js document when evicted', async () => {
        const { source } = await openTestPdf([{}])
        const doc = await getPdfDocument(source.key)
        const destroy = vi.spyOn(doc, 'destroy')
        await evictPdfDocument(source.key)
        expect(destroy).toHaveBeenCalledOnce()
        expect(isPdfDocumentCached(source.key)).toBe(false)
        await expect(evictPdfDocument(source.key)).resolves.toBeUndefined()
    })
})
