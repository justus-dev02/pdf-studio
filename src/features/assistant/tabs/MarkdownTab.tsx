import { useId, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useDoc } from '../../../store'
import { describeError, useT } from '../../../i18n'
import { pdfToMarkdown } from '../../../services/pdf'
import { compareTokens, TOKENIZER_NAME } from '../../../services/analysis/tokens'
import { downloadBlob, withSuffix } from '../../../lib/download'
import { useAsyncTask } from '../useAsyncTask'
import { Stat } from './shared'

export default function MarkdownTab() {
    const t = useT()
    const m = t.assistant.markdown
    const previewId = useId()
    const [stripHeaders, setStripHeaders] = useState(true)

    const conversion = useAsyncTask(async (signal: AbortSignal, strip: boolean) => {
        const { pages } = useDoc.getState().document
        const result = await pdfToMarkdown(pages, { stripHeadersFooters: strip, signal })
        const tokens = await compareTokens(result.rawText, result.markdown)
        return { ...result, tokens }
    })

    const download = (markdown: string) => {
        const firstSource = Object.values(useDoc.getState().document.sources)[0]
        downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), firstSource ? withSuffix(firstSource.name, '', 'md') : m.fileName)
    }

    const state = conversion.state
    return (
        <div className="space-y-4">
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{m.hint}</p>
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stripHeaders} onChange={(e) => setStripHeaders(e.target.checked)} />
                    {m.stripHeaders}
                </label>
                <Button variant="primary" onClick={() => void conversion.run(stripHeaders)} disabled={state.status === 'running'}>
                    {state.status === 'running' ? m.converting : m.convert}
                </Button>
            </div>

            {state.status === 'error' && <p role="alert" className="text-sm text-red-600">{describeError(state.error, t)}</p>}

            {state.status === 'done' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                        <Stat label={m.rawTokens} value={state.value.tokens.rawTokens.toLocaleString()} />
                        <Stat label={m.markdownTokens} value={state.value.tokens.markdownTokens.toLocaleString()} />
                        <Stat
                            label={m.difference}
                            value={`${state.value.tokens.savingsPercent > 0 ? '−' : '+'}${Math.abs(state.value.tokens.savingsPercent)} %`}
                        />
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {m.tokenizerNote(TOKENIZER_NAME)} {state.value.removedLines > 0 && m.removedLines(state.value.removedLines)}
                    </p>
                    <label htmlFor={previewId} className="sr-only">{m.preview}</label>
                    <textarea
                        id={previewId}
                        readOnly
                        value={state.value.markdown}
                        className="h-56 w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
                    />
                    <Button onClick={() => state.status === 'done' && download(state.value.markdown)}>
                        <Download className="h-4 w-4" aria-hidden />
                        {t.common.download}
                    </Button>
                </div>
            )}
        </div>
    )
}
