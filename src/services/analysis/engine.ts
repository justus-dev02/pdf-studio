import { invoke, isTauri } from '@tauri-apps/api/core'
import { analyzePdfBinary } from './binary'
import { analyzeDocumentNlp } from './nlp'
import { searchPages } from './search'
import { EngineError } from './types'
import type { AnalysisEngine, EngineErrorCode, EngineInfo, NlpAnalysisResult, PdfBinaryStructure, SearchResult } from './types'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

const ENGINE_VERSION = '0.1.0'

/**
 * Desktop build: work is delegated to the Rust engine over Tauri IPC.
 * Errors are surfaced, never swallowed: silently falling back would hide real bugs
 * (and previously returned fabricated values).
 */
export function createTauriEngine(): AnalysisEngine {
    const call = async <T>(command: string, args?: Parameters<typeof invoke>[1]): Promise<T> => {
        try {
            return await invoke<T>(command, args)
        } catch (error) {
            throw toEngineError(error)
        }
    }
    return {
        info: async () => {
            const info = await call<{ name: string; version: string; rayon_threads: number; compiled_features: string[] }>('native_get_engine_info')
            return { native: true, name: info.name, version: info.version, threads: info.rayon_threads, features: info.compiled_features }
        },
        search: (pages, options) => call<SearchResult>('native_parallel_search', { pages, options }),
        analyzeText: (pages) => call<NlpAnalysisResult>('native_analyze_nlp', { pages }),
        // Raw binary IPC body: no JSON number arrays.
        analyzeBinary: (bytes) => call<PdfBinaryStructure>('native_analyze_pdf_structure', bytes),
    }
}

/** Browser build: the same algorithms in TypeScript, executed in a Web Worker when available. */
export function createWebEngine(worker: WorkerClient | null = createWorkerClient()): AnalysisEngine {
    const info: EngineInfo = {
        native: false,
        name: 'PDF Studio Web Engine (TypeScript)',
        version: ENGINE_VERSION,
        threads: 1,
        features: ['regex_search', 'nlp_statistics', 'pdf_byte_inspector', 'sha256', worker ? 'web_worker' : 'main_thread'],
    }
    return {
        info: async () => info,
        search: async (pages, options) =>
            worker ? worker.request<SearchResult>({ method: 'search', params: { pages, options } }) : searchPages(pages, options),
        analyzeText: async (pages) =>
            worker ? worker.request<NlpAnalysisResult>({ method: 'analyzeText', params: { pages } }) : analyzeDocumentNlp(pages),
        analyzeBinary: async (bytes) =>
            worker ? worker.request<PdfBinaryStructure>({ method: 'analyzeBinary', params: { bytes } }) : analyzePdfBinary(bytes),
    }
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

export type WorkerClient = {
    request<T>(message: DistributiveOmit<WorkerRequest, 'id'>): Promise<T>
}

function createWorkerClient(): WorkerClient | null {
    if (typeof Worker === 'undefined') return null
    let worker: Worker | null = null
    let nextId = 1
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

    const ensureWorker = () => {
        if (worker) return worker
        worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const response = event.data
            const entry = pending.get(response.id)
            if (!entry) return
            pending.delete(response.id)
            if (response.ok) entry.resolve(response.result)
            else entry.reject(new EngineError(response.error.code, response.error.message))
        }
        worker.onerror = (event) => {
            const error = new EngineError('task-failed', event.message || 'Analysis worker crashed')
            pending.forEach((entry) => entry.reject(error))
            pending.clear()
            worker?.terminate()
            worker = null
        }
        return worker
    }

    return {
        request<T>(message: DistributiveOmit<WorkerRequest, 'id'>): Promise<T> {
            const id = nextId++
            return new Promise<T>((resolve, reject) => {
                pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
                ensureWorker().postMessage({ ...message, id } as WorkerRequest)
            })
        },
    }
}

const ENGINE_ERROR_CODES: EngineErrorCode[] = ['invalid-pattern', 'expected-binary-body', 'task-failed', 'ipc-failed']

export function toEngineError(error: unknown): EngineError {
    if (error instanceof EngineError) return error
    const payload = error as { code?: unknown; message?: unknown } | string | null
    if (payload && typeof payload === 'object' && typeof payload.code === 'string' && ENGINE_ERROR_CODES.includes(payload.code as EngineErrorCode)) {
        return new EngineError(payload.code as EngineErrorCode, String(payload.message ?? payload.code), { cause: error })
    }
    return new EngineError('ipc-failed', typeof payload === 'string' ? payload : String((payload as { message?: unknown })?.message ?? error), { cause: error })
}

let engine: AnalysisEngine | null = null

/** Returns the engine for the current runtime (Rust in Tauri, TypeScript in the browser). */
export function getAnalysisEngine(): AnalysisEngine {
    engine ??= isTauri() ? createTauriEngine() : createWebEngine()
    return engine
}

/** Test seam. */
export function setAnalysisEngine(next: AnalysisEngine | null): void {
    engine = next
}
