import { describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'
import { describeError, getMessages } from '.'
import { PdfError } from '../services/pdf/errors'
import { LlmError } from '../services/llm/http'
import { EngineError } from '../services/analysis/types'

type Tree = { [key: string]: unknown }

function shape(tree: Tree, prefix = ''): string[] {
    return Object.entries(tree).flatMap(([key, value]) =>
        value && typeof value === 'object' ? shape(value as Tree, `${prefix}${key}.`) : [`${prefix}${key}:${typeof value}`]
    )
}

describe('i18n', () => {
    it('has the same keys and value types in every locale', () => {
        expect(shape(en as unknown as Tree)).toEqual(shape(de as unknown as Tree))
    })

    it('uses real umlauts instead of ASCII replacements', () => {
        const text = JSON.stringify(de)
        expect(text).not.toMatch(/oeffnen|gueltig|loeschen|Aenderung|schliessen|Rueckgaengig/)
        expect(text).toContain('Rückgängig')
    })

    it('maps typed service errors to localized messages', () => {
        const t = getMessages('de')
        expect(describeError(new PdfError('password-incorrect'), t)).toBe(t.errors.pdf['password-incorrect'])
        expect(describeError(new LlmError('timeout', 'x'), t)).toBe(t.errors.llm.timeout)
        expect(describeError(new LlmError('http', 'HTTP 500'), t)).toContain('HTTP 500')
        expect(describeError(new EngineError('invalid-pattern', 'unclosed group'), t)).toContain('unclosed group')
        expect(describeError(new EngineError('ipc-failed', 'x'), t)).toBe(t.errors.engine['ipc-failed'])
        expect(describeError(new Error('?'), getMessages('en'))).toBe('Unexpected error.')
    })
})
