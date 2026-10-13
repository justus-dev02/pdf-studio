import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LlmError, requestJson } from './http'

const schema = z.object({ ok: z.literal(true) })
const respond = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, ...init })

const codeOf = async (promise: Promise<unknown>) => {
    const error = await promise.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LlmError)
    return (error as LlmError).code
}

afterEach(() => vi.useRealTimers())

describe('requestJson', () => {
    it('sends JSON and validates the response with zod', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ ok: true }))
        await expect(requestJson('http://localhost:1234/v1/x', { method: 'POST', body: { a: 1 }, schema })).resolves.toEqual({ ok: true })
        const [, init] = fetchMock.mock.calls[0]
        expect(init?.body).toBe('{"a":1}')
        expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    })

    it.each([
        [401, 'unauthorized'],
        [403, 'unauthorized'],
        [429, 'rate-limited'],
        [500, 'http'],
    ])('maps HTTP %i to %s', async (status, code) => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond('nope', { status }))
        expect(await codeOf(requestJson('https://api.example.com', { schema }))).toBe(code)
    })

    it('rejects malformed and unexpected bodies', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(respond('{not json'))
        expect(await codeOf(requestJson('https://api.example.com', { schema }))).toBe('invalid-response')
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(respond({ ok: 'yes' }))
        expect(await codeOf(requestJson('https://api.example.com', { schema }))).toBe('invalid-response')
    })

    it('distinguishes network errors, timeouts and caller aborts', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
        expect(await codeOf(requestJson('https://api.example.com', { schema }))).toBe('network')

        const hang = (_: unknown, init?: RequestInit) =>
            new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
        vi.spyOn(globalThis, 'fetch').mockImplementation(hang)
        expect(await codeOf(requestJson('https://api.example.com', { schema, timeoutMs: 10 }))).toBe('timeout')

        const controller = new AbortController()
        const pending = requestJson('https://api.example.com', { schema, signal: controller.signal })
        controller.abort()
        expect(await codeOf(pending)).toBe('aborted')
    })

    it('rejects invalid and non-http endpoints before fetching', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch')
        expect(await codeOf(requestJson('localhost:1234', { schema }))).toBe('invalid-endpoint')
        expect(await codeOf(requestJson('file:///etc/passwd', { schema }))).toBe('invalid-endpoint')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
