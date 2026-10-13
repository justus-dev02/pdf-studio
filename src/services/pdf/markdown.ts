import type { PageRef } from '../../types'
import { throwIfAborted } from './errors'
import { getPageText } from './text'
import type { PdfTextItem } from './text'

export type MarkdownOptions = {
    /** Removes lines that repeat at the top/bottom of most pages (running headers, footers, page numbers). */
    stripHeadersFooters?: boolean
    signal?: AbortSignal
}

export type MarkdownResult = {
    markdown: string
    /** Plain extracted text without any filtering, used as the baseline for token comparisons. */
    rawText: string
    removedLines: number
}

type PageLines = { pageNumber: number; lines: string[] }

/** Items whose baselines differ by less than this fraction of their height belong to the same line. */
const SAME_LINE_TOLERANCE = 0.5
const HEADER_FOOTER_LINES = 2
const MIN_REPEATED_LINE_LENGTH = 4

export async function pdfToMarkdown(pages: PageRef[], options: MarkdownOptions = {}): Promise<MarkdownResult> {
    const { stripHeadersFooters = true, signal } = options
    const pageLines: PageLines[] = []

    for (let i = 0; i < pages.length; i++) {
        throwIfAborted(signal)
        const page = pages[i]
        if (page.kind !== 'pdf') continue
        const { items } = await getPageText(page)
        pageLines.push({ pageNumber: i + 1, lines: groupIntoLines(items) })
    }

    const rawText = pageLines.map((p) => p.lines.join('\n')).join('\n\n')
    const repeated = stripHeadersFooters ? findRepeatedEdgeLines(pageLines) : new Set<string>()

    let removedLines = 0
    const sections: string[] = []
    for (const { pageNumber, lines } of pageLines) {
        const body: string[] = []
        for (const line of lines) {
            if (repeated.has(normalizeEdgeLine(line))) {
                removedLines++
                continue
            }
            body.push(toMarkdownLine(line))
        }
        sections.push(`<!-- page ${pageNumber} -->\n\n${body.join('\n').replace(/\n{3,}/g, '\n\n').trim()}`)
    }

    return { markdown: `${sections.join('\n\n')}\n`, rawText, removedLines }
}

/** Groups positioned items into reading-order lines (top to bottom, left to right). */
export function groupIntoLines(items: PdfTextItem[]): string[] {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
    const lines: { y: number; height: number; parts: PdfTextItem[] }[] = []

    for (const item of sorted) {
        const line = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(l.height, item.height) * SAME_LINE_TOLERANCE)
        if (line) line.parts.push(item)
        else lines.push({ y: item.y, height: item.height, parts: [item] })
    }

    return lines
        .sort((a, b) => a.y - b.y)
        .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.text.trim()).filter(Boolean).join(' '))
        .filter((line) => line.length > 0)
}

const normalizeEdgeLine = (line: string) => line.toLowerCase().replace(/\d+/g, '#').trim()

function findRepeatedEdgeLines(pages: PageLines[]): Set<string> {
    const result = new Set<string>()
    if (pages.length < 2) return result
    const frequency = new Map<string, number>()
    for (const { lines } of pages) {
        const edges = new Set([...lines.slice(0, HEADER_FOOTER_LINES), ...lines.slice(-HEADER_FOOTER_LINES)].map(normalizeEdgeLine))
        for (const key of edges) {
            if (key.replace(/[#\s]/g, '').length >= MIN_REPEATED_LINE_LENGTH || /^[#\s/|-]*#[#\s/|-]*$/.test(key)) {
                frequency.set(key, (frequency.get(key) ?? 0) + 1)
            }
        }
    }
    const threshold = Math.max(2, Math.ceil(pages.length * 0.5))
    for (const [key, count] of frequency) {
        if (count >= threshold) result.add(key)
    }
    return result
}

function toMarkdownLine(line: string): string {
    if (/^[•●▪◦\-–*]\s*/.test(line)) return `- ${line.replace(/^[•●▪◦\-–*]\s*/, '')}`
    if (/^\d+[.)]\s+/.test(line)) return line.replace(/^(\d+)[.)]\s+/, '$1. ')
    const letters = line.replace(/[^\p{L}]/gu, '')
    const isShouty = letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
    if (line.length <= 60 && (isShouty || /^[^.!?]{3,}:$/.test(line))) return `\n## ${line.replace(/:$/, '')}\n`
    return line
}
