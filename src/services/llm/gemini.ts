import { z } from 'zod'
import { LlmError, requestJson } from './http'
import type { ChatMessage, CompletionOptions, LlmProvider } from './types'

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta'

const generateSchema = z.object({
    candidates: z
        .array(
            z.object({
                content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).default([]) }).optional(),
                finishReason: z.string().optional(),
            })
        )
        .min(1),
})

const modelsSchema = z.object({
    models: z.array(z.object({ name: z.string(), supportedGenerationMethods: z.array(z.string()).optional() })).default([]),
})

/**
 * Google Gemini (Generative Language API).
 * The key is sent in the `x-goog-api-key` header, never in the URL, so it does not
 * appear in browser history, proxy logs or Referer headers.
 */
export function createGeminiProvider(config: { model: string; apiKey: string; endpoint?: string }): LlmProvider {
    const base = (config.endpoint || GEMINI_ENDPOINT).replace(/\/+$/, '')
    const headers = () => {
        if (!config.apiKey) throw new LlmError('missing-api-key', 'Gemini requires an API key')
        return { 'x-goog-api-key': config.apiKey }
    }

    return {
        id: 'gemini',
        async complete(messages: ChatMessage[], options: CompletionOptions = {}) {
            if (!config.model) throw new LlmError('missing-model', 'No model selected')
            const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
            const contents = messages
                .filter((m) => m.role !== 'system')
                .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))

            const data = await requestJson(`${base}/models/${encodeURIComponent(config.model)}:generateContent`, {
                method: 'POST',
                headers: headers(),
                schema: generateSchema,
                signal: options.signal,
                body: {
                    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
                    contents,
                    generationConfig: {
                        temperature: options.temperature ?? 0.2,
                        ...(options.json ? { responseMimeType: 'application/json' } : {}),
                    },
                },
            })
            const candidate = data.candidates[0]
            const text = candidate.content?.parts.map((p) => p.text ?? '').join('') ?? ''
            if (!text) throw new LlmError('invalid-response', `Empty completion (finishReason: ${candidate.finishReason ?? 'unknown'})`)
            return text
        },
        async listModels(options = {}) {
            const data = await requestJson(`${base}/models`, { headers: headers(), schema: modelsSchema, signal: options.signal, timeoutMs: 10_000 })
            return data.models
                .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true)
                .map((m) => m.name.replace(/^models\//, ''))
        },
    }
}
