import { z } from 'zod'
import type { RankedChunk } from '../analysis/retrieval'
import { LlmError } from './http'
import type { ChatMessage, LlmProvider } from './types'

/**
 * Character budget for document context sent to a model. Small local models often run with
 * 8k-token contexts; ~24k characters (~6-8k tokens) leaves room for the prompt and answer.
 */
export const MAX_CONTEXT_CHARS = 24_000

export type OutputLanguage = 'de' | 'en'

const languageName: Record<OutputLanguage, string> = { de: 'German', en: 'English' }

const summarySchema = z.object({
    summary: z.string().min(1),
    action_items: z
        .array(z.object({ text: z.string().min(1), page: z.number().int().positive().nullable().optional() }))
        .default([]),
})

export type DocumentSummary = {
    summary: string
    actionItems: { text: string; page: number | null }[]
    /** Pages whose text was sent to the model. */
    pagesUsed: number
    /** True if the document exceeded {@link MAX_CONTEXT_CHARS} and was cut. */
    truncated: boolean
}

export function buildContext(pages: { pageNumber: number; text: string }[], maxChars = MAX_CONTEXT_CHARS) {
    let used = 0
    let pagesUsed = 0
    const parts: string[] = []
    for (const page of pages) {
        const block = `[Page ${page.pageNumber}]\n${page.text.trim()}`
        if (used + block.length > maxChars) {
            const remaining = maxChars - used
            if (remaining > 200) {
                parts.push(block.slice(0, remaining))
                pagesUsed++
            }
            return { context: parts.join('\n\n'), pagesUsed, truncated: true }
        }
        parts.push(block)
        used += block.length + 2
        pagesUsed++
    }
    return { context: parts.join('\n\n'), pagesUsed, truncated: false }
}

export async function summarizeDocument(
    provider: LlmProvider,
    pages: { pageNumber: number; text: string }[],
    options: { language: OutputLanguage; signal?: AbortSignal }
): Promise<DocumentSummary> {
    const { context, pagesUsed, truncated } = buildContext(pages)
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content:
                `You summarize documents. Answer in ${languageName[options.language]}. ` +
                'Use only information from the document. Respond with a JSON object: ' +
                '{"summary": string, "action_items": [{"text": string, "page": number | null}]}. ' +
                'action_items lists concrete obligations, deadlines or tasks stated in the document (empty if there are none).',
        },
        { role: 'user', content: context },
    ]
    const raw = await provider.complete(messages, { json: true, temperature: 0.1, signal: options.signal })
    const parsed = summarySchema.safeParse(parseJsonLoose(raw))
    if (!parsed.success) throw new LlmError('invalid-response', 'Model did not return the expected JSON structure', { cause: parsed.error })
    return {
        summary: parsed.data.summary,
        actionItems: parsed.data.action_items.map((a) => ({ text: a.text, page: a.page ?? null })),
        pagesUsed,
        truncated,
    }
}

export type ChatAnswer = { answer: string; sources: number[] }

export async function answerQuestion(
    provider: LlmProvider,
    question: string,
    chunks: RankedChunk[],
    options: { language: OutputLanguage; signal?: AbortSignal }
): Promise<ChatAnswer> {
    const context = chunks.map((c) => `[Page ${c.pageNumber}]\n${c.text}`).join('\n\n')
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content:
                `Answer in ${languageName[options.language]} using only the context below. ` +
                'Cite pages as (p. N). If the context does not contain the answer, say so plainly.\n\n' +
                `Context:\n${context || '(no matching passages)'}`,
        },
        { role: 'user', content: question },
    ]
    const answer = await provider.complete(messages, { temperature: 0.1, signal: options.signal })
    return { answer: answer.trim(), sources: [...new Set(chunks.map((c) => c.pageNumber))].sort((a, b) => a - b) }
}

/** Accepts plain JSON or JSON wrapped in a Markdown code fence (common with local models). */
export function parseJsonLoose(raw: string): unknown {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
    const candidate = (fenced ? fenced[1] : raw).trim()
    try {
        return JSON.parse(candidate)
    } catch {
        const start = candidate.indexOf('{')
        const end = candidate.lastIndexOf('}')
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(candidate.slice(start, end + 1))
            } catch {
                return null
            }
        }
        return null
    }
}
