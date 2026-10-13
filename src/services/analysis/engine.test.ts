import { afterEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
const isTauri = vi.fn(() => false)
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args), isTauri: () => isTauri() }))

const { createTauriEngine, createWebEngine, getAnalysisEngine, setAnalysisEngine, toEngineError } = await import('./engine')
const { EngineError } = await import('./types')

afterEach(() => {
    invoke.mockReset()
    setAnalysisEngine(null)
})

describe('web engine', () => {
    it('runs on the main thread when no Worker is available', async () => {
        const engine = createWebEngine(null)
        const info = await engine.info()
        expect(info.native).toBe(false)
        expect(info.features).toContain('main_thread')
        expect((await engine.search([{ page_number: 1, text: 'abc abc' }], { query: 'abc', case_sensitive: false, is_regex: false, max_results_per_page: 0, snippet_padding: 0 })).total_matches).toBe(2)
        expect((await engine.analyzeText([{ page_number: 1, text: 'Ein kurzer Satz zum Testen.' }])).readability.total_words).toBe(5)
        expect((await engine.analyzeBinary(new TextEncoder().encode('%PDF-1.4'))).pdf_version).toBe('1.4')
    })

    it('delegates to the worker client when one is available', async () => {
        const request = vi.fn().mockResolvedValue({ total_matches: 0, duration_ms: 0, matches: [] })
        const engine = createWebEngine({ request })
        await engine.search([], { query: 'x', case_sensitive: false, is_regex: false, max_results_per_page: 0, snippet_padding: 0 })
        expect(request).toHaveBeenCalledWith({ method: 'search', params: expect.objectContaining({ pages: [] }) })
        expect((await engine.info()).features).toContain('web_worker')
    })
})

describe('tauri engine', () => {
    it('sends PDF bytes as a raw IPC body, not as a JSON array', async () => {
        invoke.mockResolvedValue({ sha256_hash: 'x' })
        const bytes = new Uint8Array([1, 2, 3])
        await createTauriEngine().analyzeBinary(bytes)
        expect(invoke).toHaveBeenCalledWith('native_analyze_pdf_structure', bytes)
    })

    it('maps engine info and passes structured arguments', async () => {
        invoke.mockResolvedValueOnce({ name: 'Rust', version: '1.0', rayon_threads: 8, compiled_features: ['a'] })
        expect(await createTauriEngine().info()).toEqual({ native: true, name: 'Rust', version: '1.0', threads: 8, features: ['a'] })

        invoke.mockResolvedValueOnce({ total_matches: 0, duration_ms: 0, matches: [] })
        const options = { query: 'x', case_sensitive: true, is_regex: false, max_results_per_page: 0, snippet_padding: 0 }
        await createTauriEngine().search([{ page_number: 1, text: 't' }], options)
        expect(invoke).toHaveBeenLastCalledWith('native_parallel_search', { pages: [{ page_number: 1, text: 't' }], options })
    })

    it('surfaces typed Rust errors instead of silently falling back', async () => {
        invoke.mockRejectedValue({ code: 'invalid-pattern', message: 'invalid search pattern: unclosed group' })
        const error = await createTauriEngine().analyzeText([]).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(EngineError)
        expect((error as InstanceType<typeof EngineError>).code).toBe('invalid-pattern')
    })
})

describe('toEngineError', () => {
    it('wraps unknown failures as IPC errors', () => {
        expect(toEngineError('window closed').code).toBe('ipc-failed')
        expect(toEngineError({ code: 'weird', message: 'x' }).code).toBe('ipc-failed')
        const known = new EngineError('task-failed', 'x')
        expect(toEngineError(known)).toBe(known)
    })
})

describe('getAnalysisEngine', () => {
    it('picks the engine for the runtime once', async () => {
        isTauri.mockReturnValueOnce(true)
        const engine = getAnalysisEngine()
        expect(getAnalysisEngine()).toBe(engine)
        invoke.mockResolvedValue({ name: 'Rust', version: '1', rayon_threads: 1, compiled_features: [] })
        expect((await engine.info()).native).toBe(true)
    })
})
