import { describe, expect, it, vi } from 'vitest'
import { answerQuestion, buildContext, parseJsonLoose, summarizeDocument } from './tasks'
import type { LlmProvider } from './types'

const providerReturning = (text: string): LlmProvider & { complete: ReturnType<typeof vi.fn> } => ({
    id: 'openai-compatible',
    complete: vi.fn().mockResolvedValue(text),
    listModels: vi.fn(),
})

describe('buildContext', () => {
    it('includes whole pages while they fit and flags truncation', () => {
        const pages = [1, 2, 3].map((pageNumber) => ({ pageNumber, text: 'x'.repeat(400) }))
        const full = buildContext(pages, 10_000)
        expect(full).toMatchObject({ pagesUsed: 3, truncated: false })
        expect(full.context).toContain('[Page 3]')

        const cut = buildContext(pages, 900)
        expect(cut.truncated).toBe(true)
        expect(cut.pagesUsed).toBe(2)
        expect(cut.context.length).toBeLessThanOrEqual(900)
    })
})

describe('summarizeDocument', () => {
    it('parses the JSON answer (also when wrapped in a code fence)', async () => {
        const provider = providerReturning('```json\n{"summary":"Kurz.","action_items":[{"text":"Zahlen","page":1},{"text":"Lesen"}]}\n```')
        const result = await summarizeDocument(provider, [{ pageNumber: 1, text: 'Inhalt' }], { language: 'de' })
        expect(result).toEqual({
            summary: 'Kurz.',
            actionItems: [
                { text: 'Zahlen', page: 1 },
                { text: 'Lesen', page: null },
            ],
            pagesUsed: 1,
            truncated: false,
        })
        const [messages, options] = provider.complete.mock.calls[0]
        expect(messages[0].content).toContain('German')
        expect(options).toMatchObject({ json: true })
    })

    it('rejects answers that do not match the schema', async () => {
        await expect(summarizeDocument(providerReturning('Ich bin kein JSON.'), [{ pageNumber: 1, text: 'x' }], { language: 'en' })).rejects.toMatchObject({ code: 'invalid-response' })
    })
})

describe('answerQuestion', () => {
    it('puts only retrieved passages into the prompt and returns cited pages', async () => {
        const provider = providerReturning(' Drei Monate (S. 2). ')
        const result = await answerQuestion(provider, 'Frist?', [
            { id: '2-0', pageNumber: 2, text: 'Kündigungsfrist drei Monate', score: 2 },
            { id: '1-0', pageNumber: 1, text: 'Einleitung', score: 1 },
        ], { language: 'de' })
        expect(result).toEqual({ answer: 'Drei Monate (S. 2).', sources: [1, 2] })
        expect(provider.complete.mock.calls[0][0][0].content).toContain('Kündigungsfrist drei Monate')
    })
})

describe('parseJsonLoose', () => {
    it('extracts the outermost object from surrounding prose', () => {
        expect(parseJsonLoose('Here you go: {"a": 1} hope that helps')).toEqual({ a: 1 })
        expect(parseJsonLoose('nothing')).toBeNull()
        expect(parseJsonLoose('{broken')).toBeNull()
    })
})
