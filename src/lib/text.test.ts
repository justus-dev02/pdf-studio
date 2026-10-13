import { describe, expect, it } from 'vitest'
import { wrapText } from './text'

describe('wrapText', () => {
    const measure = (value: string) => value.length * 10

    it('wraps words to fit max width', () => {
        const lines = wrapText('Hello world from pdf studio', 60, measure)
        expect(lines).toEqual(['Hello', 'world', 'from', 'pdf', 'studio'])
    })

    it('keeps explicit newlines', () => {
        const lines = wrapText('Line one\nLine two', 100, measure)
        expect(lines).toEqual(['Line one', 'Line two'])
    })

    it('breaks long words when single word exceeds line width', () => {
        const lines = wrapText('Supercalifragilistic', 50, measure)
        expect(lines.length).toBeGreaterThan(1)
        expect(lines.join('')).toBe('Supercalifragilistic')
    })

    it('handles empty strings gracefully', () => {
        const lines = wrapText('', 100, measure)
        expect(lines).toEqual([''])
    })

    it('handles text with multiple consecutive line breaks', () => {
        const lines = wrapText('Paragraph 1\n\nParagraph 2', 200, measure)
        expect(lines).toEqual(['Paragraph 1', '', 'Paragraph 2'])
    })
})
