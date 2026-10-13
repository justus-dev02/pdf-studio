/**
 * Browser implementation of the text statistics in `src-tauri/src/engine/nlp.rs`.
 * Keep both in sync: the test suites use the same fixtures and expectations.
 */
import type { ActionItem, KeyPhrase, Language, NlpAnalysisResult, PageInput, Priority, RankedSentence, ReadabilityMetrics } from './types'

const MIN_SENTENCE_CHARS = 10
const MAX_KEY_PHRASES = 10
const MAX_TOP_SENTENCES = 5
const MAX_ACTION_ITEMS = 8

const STOPWORDS_EN = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as',
    'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will',
    'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which',
    'go', 'me', 'is', 'are', 'was', 'were', 'been', 'has', 'had', 'can', 'could', 'should', 'must', 'shall', 'may',
    'these', 'those', 'than', 'then', 'also', 'into', 'its', 'our', 'your', 'any', 'each', 'such',
])

const STOPWORDS_DE = new Set([
    'der', 'die', 'das', 'und', 'in', 'zu', 'den', 'ist', 'nicht', 'von', 'sie', 'mit', 'dem', 'sich', 'des', 'auf',
    'für', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen', 'als', 'auch', 'es', 'an', 'werden', 'wird', 'aus',
    'er', 'hat', 'dass', 'sind', 'noch', 'wie', 'bei', 'um', 'am', 'im', 'nach', 'oder', 'nur', 'vor', 'zur', 'zum',
    'bis', 'mehr', 'durch', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen', 'sollte', 'wir', 'ich', 'ihr',
    'ihre', 'ihren', 'dieser', 'diese', 'dieses', 'über', 'unter', 'so', 'wenn', 'aber', 'was', 'wer', 'hier', 'da',
    'sein', 'seine', 'war', 'wurde', 'wurden', 'haben', 'bitte',
])

const DOMAIN_STOPWORDS = new Set(['pdf', 'page', 'seite'])
const ALL_STOPWORDS = new Set([...STOPWORDS_EN, ...STOPWORDS_DE, ...DOMAIN_STOPWORDS])

const ACTION_KEYWORDS_HIGH = new Set(['must', 'todo', 'verify', 'deadline', 'muss', 'müssen', 'frist', 'spätestens', 'unbedingt', 'zwingend'])
const ACTION_KEYWORDS_MEDIUM = new Set([
    'should', 'shall', 'action', 'implement', 'review', 'ensure', 'complete', 'soll', 'sollen', 'sollte', 'bitte',
    'prüfen', 'überprüfen', 'erledigen', 'einreichen', 'zahlen', 'unterschreiben',
])

const sentenceSegmenter = new Intl.Segmenter('und', { granularity: 'sentence' })
const wordSegmenter = new Intl.Segmenter('und', { granularity: 'word' })

const charCount = (value: string) => [...value].length

export function segmentWords(text: string): string[] {
    const words: string[] = []
    for (const segment of wordSegmenter.segment(text)) {
        if (segment.isWordLike) words.push(segment.segment.toLowerCase())
    }
    return words
}

export function segmentSentences(text: string): string[] {
    return [...sentenceSegmenter.segment(text)].map((s) => s.segment)
}

const isWord = (token: string) => charCount(token) > 1 && /^[\p{L}\p{N}]+$/u.test(token) && /\p{L}/u.test(token)

export function detectLanguage(words: string[]): Language {
    let de = 0
    let en = 0
    for (const word of words) {
        if (STOPWORDS_DE.has(word)) de++
        if (STOPWORDS_EN.has(word)) en++
    }
    return de > en ? 'de' : 'en'
}

export function countSyllables(word: string, language: Language): number {
    const lower = word.toLowerCase()
    if (charCount(lower) <= 3) return 1
    let count = 0
    let prevVowel = false
    for (const char of lower) {
        const vowel = 'aeiouyäöü'.includes(char)
        if (vowel && !prevVowel) count++
        prevVowel = vowel
    }
    if (language === 'en' && lower.endsWith('e') && !lower.endsWith('le') && count > 1) count--
    return Math.max(1, count)
}

export function classifyAction(sentence: string): Priority | null {
    const words = segmentWords(sentence)
    if (words.some((w) => ACTION_KEYWORDS_HIGH.has(w))) return 'high'
    if (words.some((w) => ACTION_KEYWORDS_MEDIUM.has(w))) return 'medium'
    return null
}

function readability(words: string[], sentenceCount: number, language: Language): ReadabilityMetrics {
    const totalWords = words.length
    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w, language), 0)
    if (totalWords === 0 || sentenceCount === 0) {
        return {
            language,
            total_words: totalWords,
            total_sentences: sentenceCount,
            total_syllables: totalSyllables,
            flesch_reading_ease: 0,
            flesch_kincaid_grade: null,
            avg_words_per_sentence: 0,
        }
    }
    const asl = totalWords / sentenceCount
    const asw = totalSyllables / totalWords
    // Amstad (1978) for German, Flesch (1948) / Kincaid (1975) for English.
    const ease = language === 'de' ? 180 - asl - 58.5 * asw : 206.835 - 1.015 * asl - 84.6 * asw
    const grade = language === 'en' ? Math.max(0, 0.39 * asl + 11.8 * asw - 15.59) : null
    return {
        language,
        total_words: totalWords,
        total_sentences: sentenceCount,
        total_syllables: totalSyllables,
        flesch_reading_ease: Math.min(100, Math.max(0, ease)),
        flesch_kincaid_grade: grade,
        avg_words_per_sentence: asl,
    }
}

const byScoreThen = <T extends { score: number }>(tieBreak: (a: T, b: T) => number) => (a: T, b: T) => b.score - a.score || tieBreak(a, b)

export function analyzeDocumentNlp(pages: PageInput[]): NlpAnalysisResult {
    const start = performance.now()
    const words: string[] = []
    const sentences: { page: number; text: string }[] = []

    for (const page of pages) {
        for (const sentence of segmentSentences(page.text)) {
            const normalized = sentence.split(/\s+/).filter(Boolean).join(' ')
            if (charCount(normalized) > MIN_SENTENCE_CHARS) sentences.push({ page: page.page_number, text: normalized })
        }
        words.push(...segmentWords(page.text).filter(isWord))
    }

    const language = detectLanguage(words)

    const frequency = new Map<string, number>()
    for (const word of words) {
        if (charCount(word) > 2 && !ALL_STOPWORDS.has(word) && !/^\p{N}+$/u.test(word)) {
            frequency.set(word, (frequency.get(word) ?? 0) + 1)
        }
    }

    const keyPhrases: KeyPhrase[] = [...frequency]
        .map(([phrase, freq]) => ({ phrase, frequency: freq, score: freq * Math.sqrt(charCount(phrase)) }))
        .sort(byScoreThen((a, b) => (a.phrase < b.phrase ? -1 : a.phrase > b.phrase ? 1 : 0)))
        .slice(0, MAX_KEY_PHRASES)

    const phraseScores = new Map(keyPhrases.map((k) => [k.phrase, k.score]))
    const topSentences: RankedSentence[] = sentences
        .map(({ page, text }) => {
            const content = segmentWords(text).filter((w) => !ALL_STOPWORDS.has(w))
            const sum = content.reduce((acc, w) => acc + (phraseScores.get(w) ?? 0), 0)
            return { page_number: page, sentence: text, score: content.length ? sum / Math.sqrt(content.length) : 0 }
        })
        .filter((s) => s.score > 0)
        .sort(byScoreThen((a, b) => a.page_number - b.page_number))
        .slice(0, MAX_TOP_SENTENCES)

    const actionItems: ActionItem[] = []
    for (const { page, text } of sentences) {
        if (actionItems.length >= MAX_ACTION_ITEMS) break
        const priority = classifyAction(text)
        if (priority) actionItems.push({ page_number: page, text, priority })
    }

    return {
        readability: readability(words, sentences.length, language),
        key_phrases: keyPhrases,
        top_sentences: topSentences,
        action_items: actionItems,
        execution_time_ms: Math.round(performance.now() - start),
    }
}
