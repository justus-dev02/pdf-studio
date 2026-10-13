import { describe, expect, it } from 'vitest'
import { compareTokens, countTokens } from './tokens'

describe('token counting (o200k_base)', () => {
    it('counts real BPE tokens', async () => {
        expect(await countTokens('hello world')).toBe(2)
        expect(await countTokens('')).toBe(0)
    })

    it('reports savings and overhead honestly (can be negative)', async () => {
        const raw = 'Header Header Header Body text'
        const saving = await compareTokens(raw, 'Body text')
        expect(saving.savingsPercent).toBeGreaterThan(0)

        const overhead = await compareTokens('Body text', '## Body text\n\n<!-- page 1 -->')
        expect(overhead.savingsPercent).toBeLessThan(0)

        expect((await compareTokens('', 'x')).savingsPercent).toBe(0)
    })
})
