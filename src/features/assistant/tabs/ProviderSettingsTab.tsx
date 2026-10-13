import { useId, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { describeError, useT } from '../../../i18n'
import { createProvider, PROVIDER_DEFAULTS } from '../../../services/llm'
import type { LlmSettings, ProviderId } from '../../../services/llm'
import type { LlmConfig } from '../useLlmSettings'
import { useAsyncTask } from '../useAsyncTask'

export default function ProviderSettingsTab({ llm }: { llm: LlmConfig }) {
    const t = useT()
    const s = t.assistant.settings
    const ids = { provider: useId(), endpoint: useId(), model: useId(), models: useId(), key: useId() }
    const [draft, setDraft] = useState<LlmSettings>(llm.settings)
    const [saved, setSaved] = useState(false)

    const update = (patch: Partial<LlmSettings>) => {
        setSaved(false)
        setDraft((prev) => ({ ...prev, ...patch }))
    }

    const models = useAsyncTask((signal: AbortSignal, settings: LlmSettings) => createProvider(settings).listModels({ signal }))

    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault()
                llm.save(draft)
                setSaved(true)
            }}
        >
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{s.privacy}</p>

            <div>
                <label htmlFor={ids.provider} className="mb-1 block text-xs font-medium">{s.provider}</label>
                <select
                    id={ids.provider}
                    value={draft.provider}
                    onChange={(e) => {
                        const provider = e.target.value as ProviderId
                        update({ ...PROVIDER_DEFAULTS[provider], apiKey: draft.apiKey })
                    }}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                    {(Object.keys(PROVIDER_DEFAULTS) as ProviderId[]).map((id) => (
                        <option key={id} value={id}>
                            {s.providers[id]}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor={ids.endpoint} className="mb-1 block text-xs font-medium">{s.endpoint}</label>
                <input
                    id={ids.endpoint}
                    type="url"
                    value={draft.endpoint}
                    onChange={(e) => update({ endpoint: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    aria-describedby={`${ids.endpoint}-hint`}
                />
                {draft.provider === 'openai-compatible' && <p id={`${ids.endpoint}-hint`} className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{s.endpointHint}</p>}
            </div>

            <div>
                <label htmlFor={ids.key} className="mb-1 block text-xs font-medium">
                    {s.apiKey} {draft.provider === 'openai-compatible' && <span className="font-normal text-neutral-600 dark:text-neutral-400">{s.optional}</span>}
                </label>
                <input
                    id={ids.key}
                    type="password"
                    autoComplete="off"
                    value={draft.apiKey}
                    onChange={(e) => update({ apiKey: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    aria-describedby={`${ids.key}-hint`}
                />
                <p id={`${ids.key}-hint`} className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{s.apiKeyHint}</p>
            </div>

            <div>
                <label htmlFor={ids.model} className="mb-1 block text-xs font-medium">{s.model}</label>
                <div className="flex gap-2">
                    <input
                        id={ids.model}
                        value={draft.model}
                        onChange={(e) => update({ model: e.target.value })}
                        list={ids.models}
                        className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    <Button onClick={() => void models.run(draft)} disabled={models.state.status === 'running'}>
                        {models.state.status === 'running' ? s.loadingModels : s.loadModels}
                    </Button>
                </div>
                <datalist id={ids.models}>
                    {models.state.status === 'done' && models.state.value.map((id) => <option key={id} value={id} />)}
                </datalist>
                <p role="status" className="mt-1 text-xs">
                    {models.state.status === 'done' && <span className="text-neutral-600 dark:text-neutral-400">{s.modelsLoaded(models.state.value.length)}</span>}
                    {models.state.status === 'error' && <span className="text-red-600">{describeError(models.state.error, t)}</span>}
                </p>
            </div>

            <div className="flex items-center gap-3">
                <Button type="submit" variant="primary">{s.save}</Button>
                <span role="status" className="text-xs text-emerald-600">{saved ? s.saved : ''}</span>
            </div>
        </form>
    )
}
