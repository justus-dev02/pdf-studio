import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { PageId, PageRef, SourceKey } from '../../types'
import { getPdfDocument } from './documentCache'
import { normalizePdfJsError, PdfError, throwIfAborted } from './errors'
import { blankPageSize } from './render'

/** A positioned text run in PDF points at scale 1, origin top-left. */
export type PdfTextItem = {
    text: string
    x: number
    y: number
    width: number
    height: number
}

/** Maps a character range of {@link PageText.text} back to the item it came from. */
export type TextSpan = { start: number; end: number; item: number }

export type PageText = {
    width: number
    height: number
    items: PdfTextItem[]
    /** Plain text of the page; items are joined with spaces or line breaks (pdf.js `hasEOL`). */
    text: string
    spans: TextSpan[]
}

/**
 * Text content per (source, page index). Text never changes for a loaded source,
 * so repeated searches, the text layer, markdown export and AI analysis
 * extract every page at most once.
 */
const textCache = new Map<string, Promise<PageText>>()

const cacheKey = (sourceKey: SourceKey, index: number) => `${sourceKey}:${index}`

export function getPageText(page: PageRef): Promise<PageText> {
    if (page.kind === 'blank') {
        const size = blankPageSize(page)
        return Promise.resolve({ ...size, items: [], text: '', spans: [] })
    }
    const key = cacheKey(page.sourceKey, page.index)
    const cached = textCache.get(key)
    if (cached) return cached

    const loading = extractPageText(page.sourceKey, page.index).catch((error: unknown) => {
        textCache.delete(key)
        throw error
    })
    textCache.set(key, loading)
    return loading
}

export function clearTextCache(sourceKey?: SourceKey): void {
    if (!sourceKey) {
        textCache.clear()
        return
    }
    for (const key of textCache.keys()) {
        if (key.startsWith(`${sourceKey}:`)) textCache.delete(key)
    }
}

async function extractPageText(sourceKey: SourceKey, index: number): Promise<PageText> {
    try {
        const doc = await getPdfDocument(sourceKey)
        if (index < 0 || index >= doc.numPages) {
            throw new PdfError('page-out-of-range', `Page ${index + 1} of ${doc.numPages}`)
        }
        const page = await doc.getPage(index + 1)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        page.cleanup()

        const items: PdfTextItem[] = []
        const spans: TextSpan[] = []
        let text = ''

        for (const raw of content.items) {
            if (!('str' in raw)) continue
            const item = raw as TextItem
            if (item.str.length > 0) {
                const transform = multiplyTransform(viewport.transform, item.transform)
                const height = Math.hypot(transform[2], transform[3])
                const itemIndex = items.length
                items.push({
                    text: item.str,
                    x: transform[4],
                    y: transform[5] - height,
                    width: item.width,
                    height,
                })
                spans.push({ start: text.length, end: text.length + item.str.length, item: itemIndex })
                text += item.str
            }
            if (item.hasEOL) {
                text += '\n'
            } else if (item.str.length > 0 && !text.endsWith(' ')) {
                text += ' '
            }
        }

        return { width: viewport.width, height: viewport.height, items, text: text.trimEnd(), spans }
    } catch (error) {
        throw normalizePdfJsError(error)
    }
}

export type DocumentPageText = { pageId: PageId; pageNumber: number; text: string }

/**
 * Extracts the text of all pages in document order.
 * Pages are processed sequentially: pdf.js parses in a single worker anyway, and
 * sequential extraction keeps memory flat and allows cancellation between pages.
 */
export async function extractDocumentText(
    pages: PageRef[],
    options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}
): Promise<DocumentPageText[]> {
    const result: DocumentPageText[] = []
    for (let i = 0; i < pages.length; i++) {
        throwIfAborted(options.signal)
        const page = pages[i]
        if (page.kind === 'pdf') {
            const { text } = await getPageText(page)
            result.push({ pageId: page.id, pageNumber: i + 1, text })
        }
        options.onProgress?.(i + 1, pages.length)
    }
    return result
}

/**
 * Returns the boxes covered by the character range [start, end) of {@link PageText.text}.
 * Partially covered items are cut proportionally (pdf.js only reports item widths,
 * so per-glyph positions are approximated by an even character width).
 */
export function boxesInRange(pageText: PageText, start: number, end: number): PdfTextItem[] {
    const boxes: PdfTextItem[] = []
    for (const span of pageText.spans) {
        if (span.end <= start) continue
        if (span.start >= end) break
        const item = pageText.items[span.item]
        const length = Math.max(1, span.end - span.start)
        const from = Math.max(start, span.start) - span.start
        const to = Math.min(end, span.end) - span.start
        boxes.push({
            ...item,
            text: item.text.slice(from, to),
            x: item.x + (item.width * from) / length,
            width: (item.width * (to - from)) / length,
        })
    }
    return boxes
}

function multiplyTransform(a: number[], b: number[]): number[] {
    return [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5],
    ]
}
