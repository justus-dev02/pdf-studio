import { useEffect, useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useDoc } from '../../../store'
import { describeError, useT } from '../../../i18n'
import { answerQuestion } from '../../../services/llm'
import { buildIndex, chunkPages, rankChunks } from '../../../services/analysis/retrieval'
import type { RankedChunk } from '../../../services/analysis/retrieval'
import type { DocumentPageText } from '../../../services/pdf'
import type { LlmConfig } from '../useLlmSettings'

type Message = { role: 'user'; text: string } | { role: 'assistant'; text?: string; passages: RankedChunk[]; error?: string }

const PASSAGE_PREVIEW_CHARS = 280

export default function ChatTab({ pages, llm }: { pages: DocumentPageText[]; llm: LlmConfig }) {
    const t = useT()
    const c = t.assistant.chat
    const locale = useDoc((s) => s.ui.locale)
    const [messages, setMessages] = useState<Message[]>([])
    const [question, setQuestion] = useState('')

    // The index is built once per text snapshot; queries are then O(chunks × query terms).
    const index = useMemo(() => buildIndex(chunkPages(pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })))), [pages])

    const [pending, setPending] = useState(false)
    const controller = useRef<AbortController | null>(null)
    useEffect(() => () => controller.current?.abort(), [])

    const send = async () => {
        const query = question.trim()
        if (!query || pending) return
        setQuestion('')
        setMessages((prev) => [...prev, { role: 'user', text: query }])

        const passages = rankChunks(index, query)
        if (!llm.provider || passages.length === 0) {
            setMessages((prev) => [...prev, { role: 'assistant', passages }])
            return
        }

        const current = new AbortController()
        controller.current = current
        setPending(true)
        try {
            const answer = await answerQuestion(llm.provider, query, passages, { language: locale, signal: current.signal })
            if (!current.signal.aborted) setMessages((prev) => [...prev, { role: 'assistant', text: answer.answer, passages }])
        } catch (error) {
            // Retrieval results are still useful when the model call fails.
            if (!current.signal.aborted) setMessages((prev) => [...prev, { role: 'assistant', passages, error: describeError(error, t) }])
        } finally {
            if (!current.signal.aborted) setPending(false)
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{c.hint}</p>
            <ol className="max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
                {messages.map((message, i) => (
                    <li key={i} className={message.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-indigo-600 p-2.5 text-sm text-white' : 'mr-auto max-w-[95%] space-y-2 rounded-xl bg-neutral-100 p-2.5 text-sm dark:bg-neutral-800'}>
                        <span className="sr-only">{message.role === 'user' ? c.you : c.assistant}: </span>
                        {message.role === 'user' ? message.text : <AssistantMessage message={message} />}
                    </li>
                ))}
                {pending && <li role="status" className="animate-pulse text-xs text-neutral-600 dark:text-neutral-400">{c.thinking}</li>}
            </ol>
            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    void send()
                }}
            >
                <label className="sr-only" htmlFor="assistant-question">{c.placeholder}</label>
                <input
                    id="assistant-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={c.placeholder}
                    className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                />
                <Button type="submit" variant="primary" disabled={pending || !question.trim()} aria-label={c.send}>
                    <Send className="h-4 w-4" aria-hidden />
                </Button>
            </form>
        </div>
    )
}

function AssistantMessage({ message }: { message: Extract<Message, { role: 'assistant' }> }) {
    const t = useT()
    const c = t.assistant.chat
    if (message.passages.length === 0 && !message.text) return <p>{c.noHits}</p>
    return (
        <>
            {message.error && <p role="alert" className="text-red-600 dark:text-red-400">{message.error}</p>}
            {message.text && <p className="whitespace-pre-line">{message.text}</p>}
            {message.passages.length > 0 && (
                <details open={!message.text}>
                    <summary className="cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        {message.text ? `${c.sources}: ${[...new Set(message.passages.map((p) => p.pageNumber))].map((n) => t.common.pageShort(n)).join(', ')}` : c.passages}
                    </summary>
                    <ul className="mt-1 space-y-1.5">
                        {message.passages.map((passage) => (
                            <li key={passage.id} className="rounded-lg bg-white p-2 text-xs dark:bg-neutral-900">
                                <span className="font-mono text-neutral-600 dark:text-neutral-400">{t.common.pageShort(passage.pageNumber)}</span>{' '}
                                {passage.text.length > PASSAGE_PREVIEW_CHARS ? `${passage.text.slice(0, PASSAGE_PREVIEW_CHARS)} …` : passage.text}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </>
    )
}
