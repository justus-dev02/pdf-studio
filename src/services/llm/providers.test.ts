import { describe, expect, it, vi } from 'vitest'
import { createGeminiProvider, GEMINI_ENDPOINT } from './gemini'
import { createOpenAiCompatibleProvider } from './openaiCompatible'
import { createProvider, LlmError } from '.'

const respond = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const lastCall = (mock: { mock: { calls: unknown[][] } }) => {
    const [url, init] = mock.mock.calls[mock.mock.calls.length - 1] as [URL, RequestInit]
    return { url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string> }
}

describe('Gemini provider', () => {
    it('sends the key in a header, never in the URL, and maps roles', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ candidates: [{ content: { parts: [{ text: 'Antwort' }] } }] }))
        const provider = createGeminiProvider({ model: 'gemini-2.5-flash', apiKey: 'secret-key' })
        const text = await provider.complete(
            [
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'frage' },
                { role: 'assistant', content: 'alt' },
            ],
            { json: true }
        )
        expect(text).toBe('Antwort')
        const { url, headers, body } = lastCall(fetchMock)
        expect(url).toBe(`${GEMINI_ENDPOINT}/models/gemini-2.5-flash:generateContent`)
        expect(url).not.toContain('secret-key')
        expect(headers['x-goog-api-key']).toBe('secret-key')
        expect(body.systemInstruction.parts[0].text).toBe('sys')
        expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model'])
        expect(body.generationConfig.responseMimeType).toBe('application/json')
    })

    it('requires a key and a model', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
        await expect(createGeminiProvider({ model: 'm', apiKey: '' }).complete([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ code: 'missing-api-key' })
        await expect(createGeminiProvider({ model: '', apiKey: 'k' }).complete([{ role: 'user', content: 'x' }])).rejects.toMatchObject({ code: 'missing-model' })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('treats empty candidates as an invalid response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ candidates: [{ finishReason: 'SAFETY' }] }))
        const error = await createGeminiProvider({ model: 'm', apiKey: 'k' }).complete([{ role: 'user', content: 'x' }]).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(LlmError)
        expect((error as LlmError).message).toContain('SAFETY')
    })

    it('lists models that support generateContent', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            respond({ models: [{ name: 'models/a', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] })
        )
        expect(await createGeminiProvider({ model: 'm', apiKey: 'k' }).listModels()).toEqual(['a'])
    })
})

describe('OpenAI-compatible provider', () => {
    it('posts chat completions to the configured endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ choices: [{ message: { content: 'Hallo' } }] }))
        const provider = createOpenAiCompatibleProvider({ endpoint: 'http://localhost:1234/v1/', model: 'qwen' })
        expect(await provider.complete([{ role: 'user', content: 'hi' }], { temperature: 0.5 })).toBe('Hallo')
        const { url, body, headers } = lastCall(fetchMock)
        expect(url).toBe('http://localhost:1234/v1/chat/completions')
        expect(body).toMatchObject({ model: 'qwen', temperature: 0.5, stream: false })
        expect(headers.Authorization).toBeUndefined()
    })

    it('adds a bearer token only when a key is configured and lists models', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ data: [{ id: 'llama' }, { id: 'qwen' }] }))
        const models = await createOpenAiCompatibleProvider({ endpoint: 'http://localhost:11434/v1', model: '', apiKey: 'k' }).listModels()
        expect(models).toEqual(['llama', 'qwen'])
        expect(lastCall(fetchMock).headers.Authorization).toBe('Bearer k')
    })

    it('rejects empty completions', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ choices: [{ message: { content: null } }] }))
        await expect(createOpenAiCompatibleProvider({ endpoint: 'http://x', model: 'm' }).complete([])).rejects.toMatchObject({ code: 'invalid-response' })
    })
})

describe('createProvider', () => {
    it('creates the provider for the configured id', () => {
        expect(createProvider({ provider: 'gemini', endpoint: GEMINI_ENDPOINT, model: 'm', apiKey: 'k' }).id).toBe('gemini')
        expect(createProvider({ provider: 'openai-compatible', endpoint: 'http://x', model: 'm', apiKey: '' }).id).toBe('openai-compatible')
    })
})
