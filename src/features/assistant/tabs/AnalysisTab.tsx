import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useDoc } from '../../../store'
import { describeError, useT } from '../../../i18n'
import { getAnalysisEngine } from '../../../services/analysis/engine'
import type { EngineInfo, NlpAnalysisResult, PdfBinaryStructure } from '../../../services/analysis/types'
import { getSource } from '../../../services/pdf'
import type { DocumentPageText } from '../../../services/pdf'
import type { SourceMeta } from '../../../types'
import { useAsyncTask } from '../useAsyncTask'
import { useTextAnalysis } from '../useTextAnalysis'
import { Card, Stat } from './shared'

export default function AnalysisTab({ pages }: { pages: DocumentPageText[] }) {
    const t = useT()
    const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null)
    const sources = useDoc((s) => s.document.sources)
    const analysis = useTextAnalysis(pages)

    useEffect(() => {
        getAnalysisEngine().info().then(setEngineInfo).catch(() => setEngineInfo(null))
    }, [])

    const binary = useAsyncTask(async (_signal: AbortSignal, metas: SourceMeta[]) => {
        const engine = getAnalysisEngine()
        const results: { meta: SourceMeta; result: PdfBinaryStructure }[] = []
        for (const meta of metas) results.push({ meta, result: await engine.analyzeBinary(getSource(meta.key).bytes) })
        return results
    })

    return (
        <div className="space-y-4">
            {engineInfo && (
                <p className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <Cpu className="h-3.5 w-3.5" aria-hidden />
                    {engineInfo.native ? t.assistant.engine.native(engineInfo.threads) : t.assistant.engine.web} · v{engineInfo.version}
                </p>
            )}

            <Card title={t.assistant.engine.textTitle}>
                {analysis.status === 'running' && <p role="status" className="text-sm">{t.assistant.engine.running}</p>}
                {analysis.status === 'error' && <p role="alert" className="text-sm text-red-600">{describeError(analysis.error, t)}</p>}
                {analysis.status === 'done' && <TextResult result={analysis.value} />}
            </Card>

            <Card title={t.assistant.engine.fileTitle}>
                {binary.state.status === 'done' ? (
                    <div className="space-y-4">
                        {binary.state.value.map(({ meta, result }) => (
                            <BinaryResult key={meta.key} name={meta.name} result={result} />
                        ))}
                    </div>
                ) : binary.state.status === 'error' ? (
                    <p role="alert" className="text-sm text-red-600">{describeError(binary.state.error, t)}</p>
                ) : null}
                <Button className="mt-3" variant="primary" onClick={() => void binary.run(Object.values(sources))} disabled={binary.state.status === 'running'}>
                    {binary.state.status === 'running' ? t.assistant.engine.running : binary.state.status === 'done' ? t.assistant.engine.rerun : t.assistant.engine.run}
                </Button>
            </Card>
        </div>
    )
}

function TextResult({ result }: { result: NlpAnalysisResult }) {
    const t = useT()
    const e = t.assistant.engine
    const r = result.readability
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={e.language} value={e.languages[r.language] ?? r.language} />
                <Stat label={e.readability} value={`${r.flesch_reading_ease.toFixed(0)} / 100`} hint={r.language === 'de' ? e.readabilityHintDe : e.readabilityHintEn} />
                <Stat label={e.words} value={r.total_words.toLocaleString()} />
                <Stat label={e.sentences} value={r.total_sentences.toLocaleString()} />
                {r.flesch_kincaid_grade !== null && <Stat label={e.grade} value={r.flesch_kincaid_grade.toFixed(1)} />}
            </div>

            <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">{e.keyPhrases}</h4>
                {result.key_phrases.length === 0 ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{e.none}</p>
                ) : (
                    <ul className="flex flex-wrap gap-1.5">
                        {result.key_phrases.map((k) => (
                            <li key={k.phrase} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                                {k.phrase} <span className="text-neutral-600 dark:text-neutral-400">×{k.frequency}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">{e.actionItems}</h4>
                <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">{e.actionItemsHint}</p>
                {result.action_items.length === 0 ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{e.none}</p>
                ) : (
                    <ul className="space-y-1.5">
                        {result.action_items.map((item, i) => (
                            <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 p-2 text-xs dark:border-neutral-800">
                                <span>
                                    <span className="font-mono text-neutral-600 dark:text-neutral-400">{t.common.pageShort(item.page_number)}</span> {item.text}
                                </span>
                                <span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ${item.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                                    {e.priority[item.priority]}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <p className="text-right text-xs text-neutral-600 dark:text-neutral-400">{e.duration(result.execution_time_ms)}</p>
        </div>
    )
}

function BinaryResult({ name, result }: { name: string; result: PdfBinaryStructure }) {
    const e = useT().assistant.engine
    return (
        <div>
            <h4 className="mb-2 truncate text-sm font-medium">{name}</h4>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <Stat label={e.sha256} value={<span className="break-all font-mono text-[11px]">{result.sha256_hash}</span>} />
                <Stat label={`${e.version} · ${e.size}`} value={`${result.pdf_version ?? e.unknown} · ${(result.file_size_bytes / 1024).toFixed(1)} KB`} />
                <Stat
                    label={e.objects}
                    value={`${result.has_object_streams ? '≥ ' : ''}${result.page_objects_count} / ${result.font_objects_count} / ${result.annotation_objects_count}`}
                    hint={result.has_object_streams ? e.objectsLowerBound : undefined}
                />
                <Stat label={`${e.encrypted} · ${e.embeddedFiles}`} value={`${result.is_encrypted ? e.yes : e.no} · ${result.has_embedded_files ? e.yes : e.no}`} />
            </dl>
            <p className="mt-1 text-right text-xs text-neutral-600 dark:text-neutral-400">{e.duration(result.analysis_time_ms)}</p>
        </div>
    )
}
