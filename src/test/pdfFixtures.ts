import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { openPdfSource } from '../services/pdf'
import type { PageRef, SourceMeta } from '../types'

export type TextLine = { text: string; x: number; y: number; size?: number }
export type PageSpec = { width?: number; height?: number; lines?: TextLine[] }

/** Builds a real PDF with pdf-lib. Coordinates are PDF points, origin bottom-left (like pdf-lib). */
export async function createPdf(pages: PageSpec[]): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (const spec of pages) {
        const page = doc.addPage([spec.width ?? 400, spec.height ?? 300])
        for (const line of spec.lines ?? []) page.drawText(line.text, { x: line.x, y: line.y, size: line.size ?? 12, font })
    }
    return doc.save({ useObjectStreams: false })
}

export const readFixture = (name: string): Uint8Array => new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures', name)))

let pageCounter = 0

export function pagesOf(source: SourceMeta): Extract<PageRef, { kind: 'pdf' }>[] {
    return Array.from({ length: source.pageCount }, (_, index) => ({ id: `test-page-${++pageCounter}`, kind: 'pdf' as const, sourceKey: source.key, index }))
}

export async function openTestPdf(pages: PageSpec[], name = 'test.pdf') {
    const source = await openPdfSource(await createPdf(pages), name)
    return { source, pages: pagesOf(source) }
}

export function fileFromBytes(bytes: Uint8Array, name: string, type = 'application/pdf'): File {
    return new File([bytes as Uint8Array<ArrayBuffer>], name, { type })
}
