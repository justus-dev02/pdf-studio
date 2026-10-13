import { describe, expect, it } from 'vitest'
import { buildIndex, chunkPages, rankChunks } from './retrieval'

const words = (n: number, prefix = 'w') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ')

describe('chunkPages', () => {
    it('splits long pages into overlapping chunks and keeps page numbers', () => {
        const chunks = chunkPages([{ pageNumber: 4, text: words(400) }])
        expect(chunks.map((c) => c.id)).toEqual(['4-0', '4-1', '4-2'])
        expect(chunks.every((c) => c.pageNumber === 4)).toBe(true)
        // 40 words of overlap between neighbours.
        expect(chunks[1].text.startsWith('w140 ')).toBe(true)
    })

    it('skips empty pages', () => {
        expect(chunkPages([{ pageNumber: 1, text: '   ' }])).toEqual([])
    })
})

describe('rankChunks (BM25)', () => {
    const index = buildIndex(
        chunkPages([
            { pageNumber: 1, text: 'Die Kündigungsfrist beträgt drei Monate zum Quartalsende.' },
            { pageNumber: 2, text: 'Die Rechnung ist innerhalb von 14 Tagen zu zahlen.' },
            { pageNumber: 3, text: 'Allgemeine Informationen zum Unternehmen und zur Geschichte.' },
        ])
    )

    it('ranks the chunk with the query terms first', () => {
        const [best] = rankChunks(index, 'Wie lang ist die Kündigungsfrist?')
        expect(best.pageNumber).toBe(1)
    })

    it('prefers rare terms over common ones (IDF)', () => {
        const ranked = rankChunks(index, 'die Rechnung')
        expect(ranked[0].pageNumber).toBe(2)
    })

    it('returns nothing for unrelated or empty queries', () => {
        expect(rankChunks(index, 'Photosynthese')).toEqual([])
        expect(rankChunks(index, '')).toEqual([])
        expect(rankChunks(buildIndex([]), 'egal')).toEqual([])
    })

    it('respects the result limit', () => {
        expect(rankChunks(index, 'die zum zur', 1)).toHaveLength(1)
    })
})
