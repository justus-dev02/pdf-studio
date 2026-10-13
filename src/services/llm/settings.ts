import { z } from 'zod'
import { GEMINI_ENDPOINT } from './gemini'
import type { LlmSettings, ProviderId } from './types'

const SETTINGS_KEY = 'pdf-studio.llm-settings'
const API_KEY_KEY = 'pdf-studio.llm-api-key'

export const PROVIDER_DEFAULTS: Record<ProviderId, Omit<LlmSettings, 'apiKey'>> = {
    'openai-compatible': { provider: 'openai-compatible', endpoint: 'http://localhost:1234/v1', model: '' },
    gemini: { provider: 'gemini', endpoint: GEMINI_ENDPOINT, model: 'gemini-2.5-flash' },
}

const storedSchema = z.object({
    provider: z.enum(['openai-compatible', 'gemini']),
    endpoint: z.string(),
    model: z.string(),
})

/** Storage can throw (private mode, disabled site data); settings must still work in memory. */
const safe = <T>(fn: () => T, fallback: T): T => {
    try {
        return fn()
    } catch {
        return fallback
    }
}

export function loadLlmSettings(): LlmSettings {
    const stored = safe(() => storedSchema.safeParse(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')), null)
    const base = stored?.success ? stored.data : PROVIDER_DEFAULTS['openai-compatible']
    return { ...base, apiKey: safe(() => sessionStorage.getItem(API_KEY_KEY) ?? '', '') }
}

/**
 * Endpoint and model go to localStorage. The API key only goes to sessionStorage:
 * it survives a reload but is gone when the tab closes, and it is never part of the
 * build (no VITE_* variable) or of the autosaved document.
 */
export function saveLlmSettings(settings: LlmSettings): void {
    const { apiKey, ...rest } = settings
    safe(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest)), undefined)
    safe(() => (apiKey ? sessionStorage.setItem(API_KEY_KEY, apiKey) : sessionStorage.removeItem(API_KEY_KEY)), undefined)
}
