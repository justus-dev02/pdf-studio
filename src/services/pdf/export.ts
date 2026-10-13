import { EncryptedPDFError, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import type { PageOverlays, PageRef, Shape, SourceKey, TextFont } from '../../types'
import { wrapText } from '../../lib/text'
import { PdfError, throwIfAborted } from './errors'
import { blankPageSize } from './render'
import { getSource } from './sourceRegistry'

const DEFAULT_HIGHLIGHT = '#eab308'

const standardFontMap: Record<TextFont, StandardFonts> = {
    Helvetica: StandardFonts.Helvetica,
    TimesRoman: StandardFonts.TimesRoman,
    Courier: StandardFonts.Courier,
}

/**
 * Builds a new PDF from the page list and flattens all overlays into the page content.
 *
 * Each source file is parsed once per export (not once per page), fonts and images
 * are embedded once per output document.
 */
export async function exportPdf(pages: PageRef[], overlays: PageOverlays, options: { signal?: AbortSignal } = {}): Promise<Uint8Array> {
    const out = await PDFDocument.create()
    const sourceDocs = new Map<SourceKey, Promise<PDFDocument>>()
    const assets = createAssetCache(out)

    const loadSource = (key: SourceKey) => {
        let doc = sourceDocs.get(key)
        if (!doc) {
            doc = loadForCopy(key)
            sourceDocs.set(key, doc)
        }
        return doc
    }

    for (const page of pages) {
        throwIfAborted(options.signal)
        let target: PDFPage
        if (page.kind === 'blank') {
            const size = blankPageSize(page)
            target = out.addPage([size.width, size.height])
        } else {
            const src = await loadSource(page.sourceKey)
            if (page.index < 0 || page.index >= src.getPageCount()) {
                throw new PdfError('page-out-of-range', `Page ${page.index + 1} of ${src.getPageCount()}`)
            }
            const [copied] = await out.copyPages(src, [page.index])
            target = out.addPage(copied)
        }
        const shapes = overlays[page.id] ?? []
        if (shapes.length > 0) await paintShapes(target, shapes, assets)
    }

    return out.save()
}

async function loadForCopy(key: SourceKey): Promise<PDFDocument> {
    const { bytes } = getSource(key)
    try {
        // Never pass `ignoreEncryption`: pdf-lib cannot decrypt, it would copy still-encrypted
        // content streams without the /Encrypt dictionary and produce an unreadable file.
        return await PDFDocument.load(bytes, { updateMetadata: false })
    } catch (error) {
        if (isEncryptedPdfError(error)) throw new PdfError('encrypted-export', undefined, { cause: error })
        throw new PdfError('invalid-pdf', error instanceof Error ? error.message : undefined, { cause: error })
    }
}

/**
 * pdf-lib is compiled to ES5, where subclasses of Error lose their prototype chain,
 * so `instanceof EncryptedPDFError` is false for the errors it actually throws.
 */
function isEncryptedPdfError(error: unknown): boolean {
    return error instanceof EncryptedPDFError || (error instanceof Error && /is encrypted/i.test(error.message))
}

type AssetCache = {
    font: (family: TextFont) => Promise<PDFFont>
    image: (dataUrl: string) => Promise<PDFImage>
}

function createAssetCache(doc: PDFDocument): AssetCache {
    const fonts = new Map<TextFont, Promise<PDFFont>>()
    const images = new Map<string, Promise<PDFImage>>()
    return {
        font: (family) => {
            let font = fonts.get(family)
            if (!font) {
                font = doc.embedFont(standardFontMap[family])
                fonts.set(family, font)
            }
            return font
        },
        image: (dataUrl) => {
            let image = images.get(dataUrl)
            if (!image) {
                image = embedImage(doc, dataUrl)
                images.set(dataUrl, image)
            }
            return image
        },
    }
}

function embedImage(doc: PDFDocument, dataUrl: string): Promise<PDFImage> {
    const { mime, bytes } = parseDataUrl(dataUrl)
    if (mime === 'image/png') return doc.embedPng(bytes)
    if (mime === 'image/jpeg' || mime === 'image/jpg') return doc.embedJpg(bytes)
    return Promise.reject(new PdfError('unsupported-image', mime))
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
    if (!match || !match[2]) throw new PdfError('unsupported-image', 'Expected a base64 data URL')
    const binary = atob(match[3])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { mime: match[1].toLowerCase(), bytes }
}

export function hexToRgb(hex: string | undefined, fallback = DEFAULT_HIGHLIGHT) {
    const parse = (value: string) => {
        const match = /^#([0-9a-f]{6})$/i.exec(value)
        if (!match) return null
        const num = parseInt(match[1], 16)
        return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255)
    }
    return parse(hex ?? '') ?? parse(fallback) ?? rgb(0, 0, 0)
}

/**
 * Standard 14 fonts only cover WinAnsi (Latin-1 plus a few symbols). Characters outside it
 * (emoji, CJK, many Eastern European letters) would make pdf-lib throw, so they are replaced.
 */
export function toEncodableText(text: string, font: PDFFont, replacement = '?'): string {
    const charset = new Set(font.getCharacterSet())
    let result = ''
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0
        result += char === '\n' || charset.has(code) ? char : replacement
    }
    return result
}

async function paintShapes(page: PDFPage, shapes: Shape[], assets: AssetCache) {
    const { width, height } = page.getSize()

    for (const shape of shapes) {
        switch (shape.type) {
            case 'highlight':
                page.drawRectangle({
                    x: shape.x * width,
                    y: height - (shape.y + shape.h) * height,
                    width: shape.w * width,
                    height: shape.h * height,
                    color: hexToRgb(shape.color),
                    opacity: shape.opacity,
                })
                break
            case 'pen': {
                const thickness = shape.width * Math.min(width, height)
                const color = hexToRgb(shape.color, '#000000')
                for (let i = 1; i < shape.points.length; i++) {
                    const a = shape.points[i - 1]
                    const b = shape.points[i]
                    page.drawLine({
                        start: { x: a.x * width, y: height - a.y * height },
                        end: { x: b.x * width, y: height - b.y * height },
                        thickness,
                        color,
                        lineCap: 1,
                    })
                }
                break
            }
            case 'text': {
                const font = await assets.font(shape.fontFamily)
                const lineHeight = shape.fontSize * 1.2
                const maxWidth = Math.max(4, shape.w * width - 4)
                const maxLines = Math.max(1, Math.floor((shape.h * height) / lineHeight))
                const text = toEncodableText(shape.text, font)
                const lines = wrapText(text, maxWidth, (value) => font.widthOfTextAtSize(value, shape.fontSize)).slice(0, maxLines)
                const startY = height - shape.y * height - lineHeight
                const color = hexToRgb(shape.color, '#111827')
                lines.forEach((line, i) => {
                    page.drawText(line, { x: shape.x * width + 2, y: startY - i * lineHeight, size: shape.fontSize, font, color })
                })
                break
            }
            case 'checkbox': {
                const side = shape.size * Math.min(width, height)
                const x = shape.x * width
                const y = height - shape.y * height - side
                const color = hexToRgb(shape.color, '#000000')
                page.drawRectangle({ x, y, width: side, height: side, borderWidth: 1, borderColor: color })
                if (shape.checked) {
                    const thickness = Math.max(1.5, side * 0.1)
                    page.drawLine({ start: { x: x + side * 0.2, y: y + side * 0.5 }, end: { x: x + side * 0.45, y: y + side * 0.2 }, thickness, color })
                    page.drawLine({ start: { x: x + side * 0.45, y: y + side * 0.2 }, end: { x: x + side * 0.8, y: y + side * 0.8 }, thickness, color })
                }
                break
            }
            case 'stamp': {
                const image = await assets.image(shape.imageDataUrl)
                page.drawImage(image, {
                    x: shape.x * width,
                    y: height - (shape.y + shape.h) * height,
                    width: shape.w * width,
                    height: shape.h * height,
                })
                break
            }
        }
    }
}
