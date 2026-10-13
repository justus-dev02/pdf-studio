import type { z } from 'zod'

export type LlmErrorCode =
    | 'missing-api-key'
    | 'missing-model'
    | 'invalid-endpoint'
    | 'timeout'
    | 'aborted'
    | 'network'
    | 'unauthorized'
    | 'rate-limited'
    | 'http'
    | 'invalid-response'

export class LlmError extends Error {
    readonly code: LlmErrorCode
    readonly status?: number

    constructor(code: LlmErrorCode, message: string, options?: { status?: number; cause?: unknown }) {
        super(message, { cause: options?.cause })
        this.name = 'LlmError'
        this.code = code
        this.status = options?.status
    }
}

export const DEFAULT_TIMEOUT_MS = 60_000

type RequestJsonOptions<T> = {
    method?: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: unknown
    schema: z.ZodType<T, z.ZodTypeDef, unknown>
    timeoutMs?: number
    signal?: AbortSignal
}

/**
 * fetch wrapper used by all LLM providers:
 *  - timeout and caller cancellation via one AbortController,
 *  - non-2xx responses become typed errors (401/403, 429, others),
 *  - the JSON body is validated with zod instead of optional-chaining into `any`.
 */
export async function requestJson<T>(url: string, options: RequestJsonOptions<T>): Promise<T> {
    let parsedUrl: URL
    try {
        parsedUrl = new URL(url)
    } catch (error) {
        throw new LlmError('invalid-endpoint', `Invalid URL: ${url}`, { cause: error })
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new LlmError('invalid-endpoint', `Unsupported protocol: ${parsedUrl.protocol}`)
    }

    const controller = new AbortController()
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeoutMs)
    const onCallerAbort = () => controller.abort()
    if (options.signal?.aborted) controller.abort()
    options.signal?.addEventListener('abort', onCallerAbort, { once: true })

    try {
        let response: Response
        try {
            response = await fetch(parsedUrl, {
                method: options.method ?? 'GET',
                headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
                body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
                signal: controller.signal,
            })
        } catch (error) {
            if (timedOut) throw new LlmError('timeout', `No response within ${timeoutMs} ms`, { cause: error })
            if (controller.signal.aborted) throw new LlmError('aborted', 'Request cancelled', { cause: error })
            throw new LlmError('network', error instanceof Error ? error.message : 'Network error', { cause: error })
        }

        if (!response.ok) {
            const detail = await safeErrorText(response)
            const code: LlmErrorCode = response.status === 401 || response.status === 403 ? 'unauthorized' : response.status === 429 ? 'rate-limited' : 'http'
            throw new LlmError(code, `HTTP ${response.status}${detail ? `: ${detail}` : ''}`, { status: response.status })
        }

        let json: unknown
        try {
            json = await response.json()
        } catch (error) {
            throw new LlmError('invalid-response', 'Response is not valid JSON', { cause: error })
        }
        const parsed = options.schema.safeParse(json)
        if (!parsed.success) {
            throw new LlmError('invalid-response', `Unexpected response shape: ${parsed.error.issues[0]?.message ?? 'unknown'}`, { cause: parsed.error })
        }
        return parsed.data
    } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onCallerAbort)
    }
}

async function safeErrorText(response: Response): Promise<string> {
    try {
        const text = await response.text()
        return text.slice(0, 300)
    } catch {
        return ''
    }
}
