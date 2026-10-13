/**
 * Wire types of the analysis engine. They mirror the serde structs in
 * `src-tauri/src/engine/*.rs` 1:1 (snake_case on purpose), so the Rust engine and the
 * browser fallback are interchangeable behind {@link AnalysisEngine}.
 */

export type EngineInfo = {
    native: boolean
    name: string
    version: string
    threads: number
    features: string[]
}

export type PageInput = { page_number: number; text: string }

export type SearchOptions = {
    query: string
    case_sensitive: boolean
    is_regex: boolean
    /** 0 = unlimited */
    max_results_per_page: number
    /** Context characters on each side of a match; 0 = default (40). */
    snippet_padding: number
}

export type EngineSearchMatch = {
    page_number: number
    match_index: number
    /** UTF-16 offset into the page text (a JavaScript string index). */
    char_offset: number
    match_length: number
    snippet: string
    score: number
}

export type SearchResult = {
    total_matches: number
    duration_ms: number
    matches: EngineSearchMatch[]
}

export type Language = 'de' | 'en'

export type ReadabilityMetrics = {
    language: Language
    total_words: number
    total_sentences: number
    total_syllables: number
    flesch_reading_ease: number
    /** Only defined for English text. */
    flesch_kincaid_grade: number | null
    avg_words_per_sentence: number
}

export type KeyPhrase = { phrase: string; frequency: number; score: number }
export type RankedSentence = { page_number: number; sentence: string; score: number }
export type Priority = 'high' | 'medium'
export type ActionItem = { page_number: number; text: string; priority: Priority }

export type NlpAnalysisResult = {
    readability: ReadabilityMetrics
    key_phrases: KeyPhrase[]
    top_sentences: RankedSentence[]
    action_items: ActionItem[]
    execution_time_ms: number
}

export type PdfBinaryStructure = {
    file_size_bytes: number
    sha256_hash: string
    pdf_version: string | null
    page_objects_count: number
    font_objects_count: number
    annotation_objects_count: number
    /** If true, counts are lower bounds: objects inside compressed object streams are not visible to a byte scan. */
    has_object_streams: boolean
    is_encrypted: boolean
    has_embedded_files: boolean
    analysis_time_ms: number
}

export type EngineErrorCode = 'invalid-pattern' | 'expected-binary-body' | 'task-failed' | 'ipc-failed'

export class EngineError extends Error {
    readonly code: EngineErrorCode

    constructor(code: EngineErrorCode, message: string, options?: { cause?: unknown }) {
        super(message, options)
        this.name = 'EngineError'
        this.code = code
    }
}

export interface AnalysisEngine {
    info(): Promise<EngineInfo>
    search(pages: PageInput[], options: SearchOptions): Promise<SearchResult>
    analyzeText(pages: PageInput[]): Promise<NlpAnalysisResult>
    analyzeBinary(bytes: Uint8Array): Promise<PdfBinaryStructure>
}
