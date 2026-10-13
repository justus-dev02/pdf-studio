import { afterEach, describe, expect, it } from 'vitest'
import { loadLlmSettings, PROVIDER_DEFAULTS, saveLlmSettings } from './settings'

afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
})

describe('LLM settings persistence', () => {
    it('defaults to a local OpenAI-compatible server', () => {
        expect(loadLlmSettings()).toEqual({ ...PROVIDER_DEFAULTS['openai-compatible'], apiKey: '' })
    })

    it('stores the API key only in sessionStorage', () => {
        saveLlmSettings({ provider: 'gemini', endpoint: PROVIDER_DEFAULTS.gemini.endpoint, model: 'gemini-2.5-flash', apiKey: 'top-secret' })
        expect(JSON.stringify({ ...localStorage })).not.toContain('top-secret')
        expect(JSON.stringify({ ...sessionStorage })).toContain('top-secret')
        expect(loadLlmSettings()).toMatchObject({ provider: 'gemini', apiKey: 'top-secret' })

        saveLlmSettings({ ...loadLlmSettings(), apiKey: '' })
        expect(sessionStorage.length).toBe(0)
    })

    it('ignores corrupt stored settings', () => {
        localStorage.setItem('pdf-studio.llm-settings', '{"provider":"evil"}')
        expect(loadLlmSettings().provider).toBe('openai-compatible')
        localStorage.setItem('pdf-studio.llm-settings', 'not json')
        expect(loadLlmSettings().provider).toBe('openai-compatible')
    })
})
