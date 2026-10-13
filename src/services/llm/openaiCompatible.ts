import { z } from 'zod'
import { LlmError, requestJson } from './http'
import type { ChatMessage, CompletionOptions, LlmProvider } from './types'

const completionSchema = z.object({
    choices: z
        .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
        .min(1),
})

const modelsSchema = z.object({ data: z.array(z.object({ id: z.string() })) })

/**
 * Any server that speaks the OpenAI Chat Completions API:
 * LM Studio, Ollama (`/v1`), llama.cpp server, vLLM, or a self-hosted proxy.
 */
export function createOpenAiCompatibleProvider(config: { endpoint: string; model: string; apiKey?: string }): LlmProvider {
    const base = config.endpoint.replace(/\/+$/, '')
    const headers: Record<string, string> = config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}

    return {
        id: 'openai-compatible',
        async complete(messages: ChatMessage[], options: CompletionOptions = {}) {
            if (!config.model) throw new LlmError('missing-model', 'No model selected')
            const data = await requestJson(`${base}/chat/completions`, {
                method: 'POST',
                headers,
                schema: completionSchema,
                signal: options.signal,
                body: {
                    model: config.model,
                    messages,
                    temperature: options.temperature ?? 0.2,
                    stream: false,
                    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
                },
            })
            const content = data.choices[0].message.content
            if (!content) throw new LlmError('invalid-response', 'Empty completion')
            return content
        },
        async listModels(options = {}) {
            const data = await requestJson(`${base}/models`, { headers, schema: modelsSchema, signal: options.signal, timeoutMs: 10_000 })
            return data.data.map((m) => m.id)
        },
    }
}
