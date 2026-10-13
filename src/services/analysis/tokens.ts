/**
 * Real token counts with the o200k_base BPE vocabulary (GPT-4o family).
 * Other model families tokenize differently; the UI states this explicitly.
 *
 * The vocabulary is ~2 MB, so it is loaded lazily the first time a count is requested
 * and never ends up in the main bundle.
 */
export const TOKENIZER_NAME = 'o200k_base'

let tokenizer: Promise<{ countTokens: (text: string) => number }> | null = null

const loadTokenizer = () => {
    tokenizer ??= import('gpt-tokenizer/encoding/o200k_base')
    return tokenizer
}

export async function countTokens(text: string): Promise<number> {
    const { countTokens: count } = await loadTokenizer()
    return count(text)
}

export type TokenComparison = {
    rawTokens: number
    markdownTokens: number
    /** Positive = Markdown needs fewer tokens than the raw text, negative = more. */
    savingsPercent: number
}

export async function compareTokens(rawText: string, markdown: string): Promise<TokenComparison> {
    const [rawTokens, markdownTokens] = await Promise.all([countTokens(rawText), countTokens(markdown)])
    const savingsPercent = rawTokens > 0 ? Math.round(((rawTokens - markdownTokens) / rawTokens) * 1000) / 10 : 0
    return { rawTokens, markdownTokens, savingsPercent }
}
