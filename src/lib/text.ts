export type TextMeasure = (text: string) => number

export function wrapText(text: string, maxWidth: number, measure: TextMeasure): string[] {
    const lines: string[] = []
    const paragraphs = text.split(/\r?\n/)

    for (const paragraph of paragraphs) {
        if (!paragraph) {
            lines.push('')
            continue
        }
        const words = paragraph.split(/\s+/)
        let current = ''

        for (const word of words) {
            const next = current ? `${current} ${word}` : word
            if (measure(next) <= maxWidth) {
                current = next
                continue
            }
            if (current) {
                lines.push(current)
                current = word
                continue
            }
            lines.push(...breakWord(word, maxWidth, measure))
            current = ''
        }
        if (current) lines.push(current)
    }

    return lines
}

function breakWord(word: string, maxWidth: number, measure: TextMeasure): string[] {
    const parts: string[] = []
    let current = ''
    for (const char of word) {
        const next = current + char
        if (measure(next) <= maxWidth) {
            current = next
        } else {
            if (current) parts.push(current)
            current = char
        }
    }
    if (current) parts.push(current)
    return parts
}
