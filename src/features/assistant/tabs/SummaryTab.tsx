import { useState } from 'react'
import { CheckCircle2, Copy } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useDoc } from '../../../store'
import { describeError, useT } from '../../../i18n'
import { summarizeDocument } from '../../../services/llm'
import type { DocumentPageText } from '../../../services/pdf'
import { useAsyncTask } from '../useAsyncTask'
import type { LlmConfig } from '../useLlmSettings'
import { useTextAnalysis } from '../useTextAnalysis'
import { Card } from './shared'

export default function SummaryTab({ pages, llm }: { pages: DocumentPageText[]; llm: LlmConfig }) {
    const t = useT()
    const s = t.assistant.summary
    const locale = useDoc((st) => st.ui.locale)
    const analysis = useTextAnalysis(pages)
    const [copied, setCopied] = useState(false)

    const summary = useAsyncTask((signal: AbortSignal) => {
        if (!llm.provider) throw new Error('not configured')
        return summarizeDocument(llm.provider, pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })), { language: locale, signal })
    })

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard can be blocked by permissions; the text stays selectable.
        }
    }

    return (
        <div className="space-y-4">
            <Card title={s.extractiveTitle}>
                <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">{s.extractiveHint}</p>
                {analysis.status === 'running' && <p role="status" className="text-sm">{t.assistant.engine.running}</p>}
                {analysis.status === 'error' && <p role="alert" className="text-sm text-red-600">{describeError(analysis.error, t)}</p>}
                {analysis.status === 'done' &&
                    (analysis.value.top_sentences.length === 0 ? (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.assistant.engine.none}</p>
                    ) : (
                        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                            {analysis.value.top_sentences.map((sentence, i) => (
                                <li key={i}>
                                    {sentence.sentence} <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400">({t.common.pageShort(sentence.page_number)})</span>
                                </li>
                            ))}
                        </ol>
                    ))}
            </Card>

            <Card title={s.llmTitle}>
                {!llm.provider ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{s.configureFirst}</p>
                ) : (
                    <>
                        {llm.host && <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">{s.privacy(llm.host)}</p>}
                        {summary.state.status === 'error' && <p role="alert" className="mb-2 text-sm text-red-600">{describeError(summary.state.error, t)}</p>}
                        {summary.state.status === 'done' && (
                            <div className="mb-3 space-y-3">
                                {summary.state.value.truncated && <p className="text-xs text-amber-700 dark:text-amber-400">{s.truncated(summary.state.value.pagesUsed, pages.length)}</p>}
                                <div className="relative rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                                    <p className="whitespace-pre-line pr-16">{summary.state.value.summary}</p>
                                    <button type="button" onClick={() => summary.state.status === 'done' && void copy(summary.state.value.summary)} className="absolute right-2 top-2 inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
                                        <Copy className="h-3.5 w-3.5" aria-hidden />
                                        {copied ? t.common.copied : t.common.copy}
                                    </button>
                                </div>
                                {summary.state.value.actionItems.length > 0 && (
                                    <div>
                                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">{s.actionItems}</h4>
                                        <ul className="space-y-1.5">
                                            {summary.state.value.actionItems.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                                                    <span>
                                                        {item.text}
                                                        {item.page !== null && <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400"> ({t.common.pageShort(item.page)})</span>}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button variant="primary" onClick={() => void summary.run()} disabled={summary.state.status === 'running'}>
                                {summary.state.status === 'running' ? s.running : s.run}
                            </Button>
                            {summary.state.status === 'running' && <Button onClick={summary.cancel}>{t.common.cancel}</Button>}
                        </div>
                    </>
                )}
            </Card>
        </div>
    )
}
