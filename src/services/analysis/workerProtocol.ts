import type { EngineErrorCode, PageInput, SearchOptions } from './types'

export type WorkerRequest = { id: number } & (
    | { method: 'search'; params: { pages: PageInput[]; options: SearchOptions } }
    | { method: 'analyzeText'; params: { pages: PageInput[] } }
    | { method: 'analyzeBinary'; params: { bytes: Uint8Array } }
)

export type WorkerResponse =
    | { id: number; ok: true; result: unknown }
    | { id: number; ok: false; error: { code: EngineErrorCode; message: string } }
