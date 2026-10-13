/// <reference lib="webworker" />
/**
 * Runs the browser analysis engine off the main thread, so NLP over hundreds of
 * pages or hashing a 200 MB file never blocks rendering or input.
 */
import { analyzePdfBinary } from './binary'
import { analyzeDocumentNlp } from './nlp'
import { searchPages } from './search'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'
import { EngineError } from './types'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data
    try {
        let result: unknown
        switch (request.method) {
            case 'search':
                result = searchPages(request.params.pages, request.params.options)
                break
            case 'analyzeText':
                result = analyzeDocumentNlp(request.params.pages)
                break
            case 'analyzeBinary':
                result = await analyzePdfBinary(request.params.bytes)
                break
        }
        scope.postMessage({ id: request.id, ok: true, result } satisfies WorkerResponse)
    } catch (error) {
        const code = error instanceof EngineError ? error.code : 'task-failed'
        const message = error instanceof Error ? error.message : String(error)
        scope.postMessage({ id: request.id, ok: false, error: { code, message } } satisfies WorkerResponse)
    }
}
