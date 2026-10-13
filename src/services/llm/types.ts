export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = { role: ChatRole; content: string }

export type CompletionOptions = {
    temperature?: number
    /** Ask the provider for a JSON object response where supported. */
    json?: boolean
    signal?: AbortSignal
}

export type ProviderId = 'openai-compatible' | 'gemini'

export interface LlmProvider {
    readonly id: ProviderId
    complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string>
    listModels(options?: { signal?: AbortSignal }): Promise<string[]>
}

export type LlmSettings = {
    provider: ProviderId
    /** Base URL, e.g. http://localhost:1234/v1 (LM Studio) or http://localhost:11434/v1 (Ollama). */
    endpoint: string
    model: string
    /** Entered at runtime by the user; never bundled, never persisted beyond the browser session. */
    apiKey: string
}
