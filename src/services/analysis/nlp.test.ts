/**
 * Mirrors the tests in src-tauri/src/engine/nlp.rs: both engines must produce the same results.
 */
import { describe, expect, it } from 'vitest'
import { analyzeDocumentNlp, classifyAction, countSyllables, detectLanguage, segmentWords } from './nlp'

const pages = (...texts: string[]) => texts.map((text, i) => ({ page_number: i + 1, text }))

describe('nlp (parity with Rust engine)', () => {
    it('counts syllables for English and German', () => {
        expect(countSyllables('test', 'en')).toBe(1)
        expect(countSyllables('performance', 'en')).toBe(3)
        expect(countSyllables('architecture', 'en')).toBe(4)
        expect(countSyllables('Häuser', 'de')).toBe(2)
        expect(countSyllables('Kündigungsfrist', 'de')).toBe(4)
    })

    it('detects the language from stopwords', () => {
        const de = analyzeDocumentNlp(pages('Der Vertrag ist bis zum Ende des Monats zu kündigen und die Frist muss eingehalten werden.'))
        expect(de.readability.language).toBe('de')
        expect(de.readability.flesch_kincaid_grade).toBeNull()

        const en = analyzeDocumentNlp(pages('The contract must be cancelled by the end of the month and the deadline is strict.'))
        expect(en.readability.language).toBe('en')
        expect(en.readability.flesch_kincaid_grade).not.toBeNull()
        expect(detectLanguage([])).toBe('en')
    })

    it('extracts action items with priorities', () => {
        const result = analyzeDocumentNlp(
            pages('PDF Studio must ensure high performance and zero telemetry.', 'The engineering team should review the architecture soon.', 'This sentence is only informational content.')
        )
        expect(result.action_items.map((a) => [a.page_number, a.priority])).toEqual([
            [1, 'high'],
            [2, 'medium'],
        ])
    })

    it('ranks key phrases by frequency and skips stopwords', () => {
        const result = analyzeDocumentNlp(pages('Rechnung Rechnung Rechnung Betrag Betrag und und und und der der der.'))
        expect(result.key_phrases.map((k) => k.phrase)).toEqual(['rechnung', 'betrag'])
        expect(result.key_phrases[0].frequency).toBe(3)
    })

    it('returns zero metrics instead of fake values for empty input', () => {
        const result = analyzeDocumentNlp(pages('', '   '))
        expect(result.readability).toMatchObject({ total_words: 0, total_sentences: 0, flesch_reading_ease: 0 })
        expect(result.key_phrases).toEqual([])
        expect(result.top_sentences).toEqual([])
    })

    it('matches the reference Flesch formula', () => {
        const r = analyzeDocumentNlp(pages('The cat sat on the mat. The dog ran to the park.')).readability
        expect(r.total_words).toBe(12)
        expect(r.total_sentences).toBe(2)
        const expected = 206.835 - 1.015 * 6 - 84.6 * (r.total_syllables / 12)
        expect(r.flesch_reading_ease).toBeCloseTo(Math.min(100, Math.max(0, expected)), 3)
    })

    it('ranks top sentences by key phrase density with page references', () => {
        const result = analyzeDocumentNlp(pages('Die Rechnung ist fällig. Die Rechnung enthält den Betrag.', 'Ein ganz anderer Satz ohne Bezug.'))
        expect(result.top_sentences[0].page_number).toBe(1)
        expect(result.top_sentences[0].sentence).toContain('Rechnung')
    })

    it('classifies German action sentences', () => {
        expect(classifyAction('Bitte unterschreiben Sie das Formular.')).toBe('medium')
        expect(classifyAction('Die Frist endet morgen.')).toBe('high')
        expect(classifyAction('Das Wetter ist schön.')).toBeNull()
        expect(segmentWords('Größe, ändern!')).toEqual(['größe', 'ändern'])
    })
})
