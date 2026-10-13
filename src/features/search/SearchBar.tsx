import { useEffect, useId, useRef } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useDoc, useDocActions } from '../../store'
import { useT } from '../../i18n'
import { MAX_SEARCH_RESULTS } from '../../services/analysis/documentSearch'
import { useDocumentSearch } from './useDocumentSearch'

type SearchBarProps = {
    onClose: () => void
    /** Changes whenever the bar is requested again (e.g. Ctrl+F while open) to re-focus the input. */
    focusToken: number
}

export default function SearchBar({ onClose, focusToken }: SearchBarProps) {
    const t = useT()
    const inputRef = useRef<HTMLInputElement>(null)
    const inputId = useId()
    const statusId = useId()
    const search = useDoc(useShallow((s) => ({
        query: s.search.query,
        caseSensitive: s.search.caseSensitive,
        regex: s.search.regex,
        count: s.search.matches.length,
        index: s.search.matchIndex,
        isSearching: s.search.isSearching,
    })))
    const actions = useDocActions()
    const { error } = useDocumentSearch(true)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [focusToken])

    const status = error
        ? error
        : search.isSearching
          ? t.search.searching
          : search.count > 0
            ? `${t.search.matchOf(search.index + 1, search.count)}${search.count >= MAX_SEARCH_RESULTS ? ` ${t.search.truncated(MAX_SEARCH_RESULTS)}` : ''}`
            : search.query
              ? t.search.noMatches
              : ''

    return (
        <div role="search" className="flex w-full flex-wrap items-center gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div className="relative min-w-[12rem] max-w-sm flex-1">
                <label htmlFor={inputId} className="sr-only">{t.search.label}</label>
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" aria-hidden />
                <input
                    ref={inputRef}
                    id={inputId}
                    type="search"
                    value={search.query}
                    onChange={(e) => actions.setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            if (e.shiftKey) actions.prevSearchMatch()
                            else actions.nextSearchMatch()
                        }
                        if (e.key === 'Escape') onClose()
                    }}
                    placeholder={t.search.placeholder}
                    aria-describedby={statusId}
                    aria-invalid={Boolean(error)}
                    className="w-full rounded-xl border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
            </div>
            <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={search.caseSensitive} onChange={(e) => actions.setSearchOptions({ caseSensitive: e.target.checked })} />
                {t.search.caseSensitive}
            </label>
            <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={search.regex} onChange={(e) => actions.setSearchOptions({ regex: e.target.checked })} />
                {t.search.regex}
            </label>
            <span id={statusId} role="status" className={`font-mono text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                {status}
            </span>
            <button type="button" onClick={actions.prevSearchMatch} disabled={search.count === 0} aria-label={t.search.previous} title={t.search.previous} className="rounded border border-neutral-200 p-1 disabled:opacity-40 dark:border-neutral-700">
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" onClick={actions.nextSearchMatch} disabled={search.count === 0} aria-label={t.search.next} title={t.search.next} className="rounded border border-neutral-200 p-1 disabled:opacity-40 dark:border-neutral-700">
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" onClick={onClose} aria-label={t.common.close} title={t.common.close} className="rounded p-1 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="h-3.5 w-3.5" aria-hidden />
            </button>
        </div>
    )
}
