import { de } from './de'
import type { Messages } from './de'
import { en } from './en'
import { useDoc } from '../store/docStore'
import { isPdfError } from '../services/pdf/errors'
import { LlmError } from '../services/llm/http'
import { EngineError } from '../services/analysis/types'

export type { Messages }
export type Locale = 'de' | 'en'

export const LOCALES: Record<Locale, { label: string; messages: Messages }> = {
    de: { label: 'Deutsch', messages: de },
    en: { label: 'English', messages: en },
}

/**
 * Typed message lookup without a runtime i18n dependency: a missing key in any
 * locale is a compile error, and parameterized messages are plain functions.
 */
export const useT = (): Messages => useDoc((s) => LOCALES[s.ui.locale].messages)

export const getMessages = (locale: Locale): Messages => LOCALES[locale].messages

/** Maps typed service errors to a localized, user-facing message. */
export function describeError(error: unknown, t: Messages): string {
    if (isPdfError(error)) return t.errors.pdf[error.code]
    if (error instanceof LlmError) {
        const base = t.errors.llm[error.code]
        return error.code === 'http' ? `${base} (${error.message})` : base
    }
    if (error instanceof EngineError) {
        return error.code === 'invalid-pattern' ? `${t.errors.engine[error.code]} ${error.message}` : t.errors.engine[error.code]
    }
    return t.errors.generic
}
