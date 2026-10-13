import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDoc, useDocActions } from '../../store'
import { describeError, useT } from '../../i18n'
import { searchDocument } from '../../services/analysis/documentSearch'
import { isCancelled } from '../../services/pdf'

export const SEARCH_DEBOUNCE_MS = 250

/**
 * Runs the document search whenever query, options or pages change.
 * Debounced while typing; a newer search aborts the previous one, so results of an
 * outdated query can never overwrite newer ones.
 */
export function useDocumentSearch(enabled: boolean) {
    const t = useT()
    const { query, caseSensitive, regex } = useDoc(useShallow((s) => ({ query: s.search.query, caseSensitive: s.search.caseSensitive, regex: s.search.regex })))
    const pages = useDoc((s) => s.document.pages)
    const actions = useDocActions()
    const [error, setError] = useState<string | null>(null)
    const lastSearch = useRef('')

    useEffect(() => {
        if (!enabled) return
        if (!query.trim()) {
            actions.setSearchMatches([])
            actions.setIsSearching(false)
            setError(null)
            return
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
            actions.setIsSearching(true)
            searchDocument(pages, query, { caseSensitive, regex, signal: controller.signal })
                .then((matches) => {
                    if (controller.signal.aborted) return
                    setError(null)
                    // Jump to the first hit only for a new query, not when results refresh after page edits.
                    const key = JSON.stringify([query, caseSensitive, regex])
                    actions.setSearchMatches(matches, { navigate: key !== lastSearch.current })
                    lastSearch.current = key
                })
                .catch((err: unknown) => {
                    if (controller.signal.aborted || isCancelled(err)) return
                    actions.setSearchMatches([])
                    setError(describeError(err, t))
                })
                .finally(() => {
                    if (!controller.signal.aborted) actions.setIsSearching(false)
                })
        }, SEARCH_DEBOUNCE_MS)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [enabled, query, caseSensitive, regex, pages, actions, t])

    return { error }
}
