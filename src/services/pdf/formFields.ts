import type { PageId, PageRef, TextBox } from '../../types'
import { clamp } from '../../lib/geometry'
import { throwIfAborted } from './errors'
import { getPageText } from './text'

export type DetectedFormField = {
    pageId: PageId
    label: string
    shape: TextBox
}

const LABEL_KEYWORDS = ['name', 'vorname', 'nachname', 'datum', 'date', 'unterschrift', 'signature', 'adresse', 'address', 'straße', 'strasse', 'e-mail', 'email', 'ort', 'plz', 'iban', 'bic', 'telefon', 'phone', 'firma', 'company']
/** A run of underscores or dots is the classic "write here" placeholder. */
const BLANK_PLACEHOLDER = /_{3,}|\.{6,}/
const FIELD_GAP_PT = 6
const FIELD_WIDTH = 0.3

/**
 * Heuristic detection of fillable spots in non-interactive (flat) forms:
 * a short label line that ends with ":" or contains a known keyword, or a placeholder line.
 * Coordinates are computed from the real page size, so A3, Letter and landscape pages work.
 */
export async function detectFormFields(pages: PageRef[], options: { signal?: AbortSignal } = {}): Promise<DetectedFormField[]> {
    const detected: DetectedFormField[] = []

    for (const page of pages) {
        throwIfAborted(options.signal)
        if (page.kind !== 'pdf') continue
        const { width, height, items } = await getPageText(page)

        for (const item of items) {
            const label = item.text.trim()
            if (!isFieldLabel(label)) continue

            const fieldHeight = Math.max(item.height * 1.6, 14) / height
            const startsAfterLabel = !BLANK_PLACEHOLDER.test(label)
            const x = startsAfterLabel ? (item.x + item.width + FIELD_GAP_PT) / width : item.x / width
            const w = startsAfterLabel ? FIELD_WIDTH : Math.max(item.width / width, 0.1)
            detected.push({
                pageId: page.id,
                label,
                shape: {
                    type: 'text',
                    x: clamp(x, 0, 1 - w),
                    y: clamp((item.y - item.height * 0.3) / height, 0, 1 - fieldHeight),
                    w,
                    h: fieldHeight,
                    text: '',
                    fontSize: clamp(Math.round(item.height), 8, 18),
                    fontFamily: 'Helvetica',
                    color: '#111827',
                },
            })
        }
    }
    return detected
}

export function isFieldLabel(text: string): boolean {
    if (!text || text.length > 60) return false
    if (BLANK_PLACEHOLDER.test(text)) return true
    const lower = text.toLowerCase()
    const endsWithColon = /[\p{L})]:\s*$/u.test(text)
    const hasKeyword = LABEL_KEYWORDS.some((keyword) => new RegExp(`(^|[^\\p{L}])${keyword}([^\\p{L}]|$)`, 'u').test(lower))
    return endsWithColon || (hasKeyword && text.length <= 30)
}
