/**
 * Lexical retrieval for the document chat: pages are split into overlapping chunks
 * and ranked with Okapi BM25. This is honest keyword retrieval, not vector search;
 * it needs no model download and works fully offline.
 */
import { segmentWords } from './nlp'

export type Chunk = {
    id: string
    pageNumber: number
    text: string
}

export type RankedChunk = Chunk & { score: number }

const CHUNK_WORDS = 180
const CHUNK_OVERLAP_WORDS = 40
const BM25_K1 = 1.2
const BM25_B = 0.75

export function chunkPages(pages: { pageNumber: number; text: string }[]): Chunk[] {
    const chunks: Chunk[] = []
    for (const page of pages) {
        const words = page.text.split(/\s+/).filter(Boolean)
        if (words.length === 0) continue
        const step = CHUNK_WORDS - CHUNK_OVERLAP_WORDS
        for (let start = 0, part = 0; start < words.length; start += step, part++) {
            chunks.push({ id: `${page.pageNumber}-${part}`, pageNumber: page.pageNumber, text: words.slice(start, start + CHUNK_WORDS).join(' ') })
            if (start + CHUNK_WORDS >= words.length) break
        }
    }
    return chunks
}

export type Bm25Index = {
    chunks: Chunk[]
    termFrequencies: Map<string, number>[]
    documentFrequency: Map<string, number>
    lengths: number[]
    averageLength: number
}

export function buildIndex(chunks: Chunk[]): Bm25Index {
    const termFrequencies = chunks.map((chunk) => {
        const tf = new Map<string, number>()
        for (const term of segmentWords(chunk.text)) tf.set(term, (tf.get(term) ?? 0) + 1)
        return tf
    })
    const documentFrequency = new Map<string, number>()
    for (const tf of termFrequencies) {
        for (const term of tf.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
    const lengths = termFrequencies.map((tf) => [...tf.values()].reduce((a, b) => a + b, 0))
    const averageLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
    return { chunks, termFrequencies, documentFrequency, lengths, averageLength }
}

export function rankChunks(index: Bm25Index, query: string, limit = 4): RankedChunk[] {
    const terms = [...new Set(segmentWords(query))]
    const n = index.chunks.length
    if (n === 0 || terms.length === 0) return []

    const ranked: RankedChunk[] = []
    index.chunks.forEach((chunk, i) => {
        const tf = index.termFrequencies[i]
        let score = 0
        for (const term of terms) {
            const freq = tf.get(term)
            if (!freq) continue
            const df = index.documentFrequency.get(term) ?? 0
            const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
            const norm = BM25_K1 * (1 - BM25_B + (BM25_B * index.lengths[i]) / (index.averageLength || 1))
            score += idf * ((freq * (BM25_K1 + 1)) / (freq + norm))
        }
        if (score > 0) ranked.push({ ...chunk, score })
    })
    return ranked.sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber).slice(0, limit)
}
