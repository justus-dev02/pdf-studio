import { createGeminiProvider } from './gemini'
import { createOpenAiCompatibleProvider } from './openaiCompatible'
import type { LlmProvider, LlmSettings } from './types'

export { LlmError } from './http'
export type { LlmErrorCode } from './http'
export { loadLlmSettings, saveLlmSettings, PROVIDER_DEFAULTS } from './settings'
export type { ChatMessage, LlmProvider, LlmSettings, ProviderId } from './types'
export { summarizeDocument, answerQuestion, MAX_CONTEXT_CHARS } from './tasks'
export type { DocumentSummary, ChatAnswer } from './tasks'

export function createProvider(settings: LlmSettings): LlmProvider {
    switch (settings.provider) {
        case 'gemini':
            return createGeminiProvider({ model: settings.model, apiKey: settings.apiKey, endpoint: settings.endpoint })
        case 'openai-compatible':
            return createOpenAiCompatibleProvider({ endpoint: settings.endpoint, model: settings.model, apiKey: settings.apiKey })
    }
}
