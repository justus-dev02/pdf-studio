import { useCallback, useMemo, useState } from 'react'
import { createProvider, loadLlmSettings, saveLlmSettings } from '../../services/llm'
import type { LlmProvider, LlmSettings } from '../../services/llm'

export type LlmConfig = {
    settings: LlmSettings
    save: (next: LlmSettings) => void
    /** Null until a provider is usable (model chosen, key present where required). */
    provider: LlmProvider | null
    /** Host that receives document text, shown to the user before sending. */
    host: string | null
}

export function isConfigured(settings: LlmSettings): boolean {
    if (!settings.model.trim()) return false
    if (settings.provider === 'gemini' && !settings.apiKey.trim()) return false
    return settings.endpoint.trim().length > 0
}

export function useLlmSettings(): LlmConfig {
    const [settings, setSettings] = useState<LlmSettings>(loadLlmSettings)

    const save = useCallback((next: LlmSettings) => {
        setSettings(next)
        saveLlmSettings(next)
    }, [])

    const provider = useMemo(() => (isConfigured(settings) ? createProvider(settings) : null), [settings])
    const host = useMemo(() => {
        try {
            return new URL(settings.endpoint).host
        } catch {
            return null
        }
    }, [settings.endpoint])

    return { settings, save, provider, host }
}
