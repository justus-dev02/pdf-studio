import { forwardRef, memo, useEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { FixedSizeList } from 'react-window'
import type { ListChildComponentProps } from 'react-window'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useDoc, useDocActions } from '../../store'
import type { DocActions } from '../../store'
import { useT } from '../../i18n'
import type { Messages } from '../../i18n'
import { isCancelled, renderPage } from '../../services/pdf'
import type { PageRef } from '../../types'
import { useElementSize } from '../../hooks/useElementSize'

const ITEM_HEIGHT = 236
const OVERSCAN = 3
/** Render thumbnails at ~0.3x; CSS scales them to the column width. */
const THUMBNAIL_ZOOM = 0.3

export default function Sidebar() {
    const t = useT()
    const { pages, activePage, open } = useDoc(useShallow((s) => ({ pages: s.document.pages, activePage: s.viewer.activePage, open: s.ui.sidebarOpen })))
    const actions = useDocActions()
    const listRef = useRef<HTMLDivElement>(null)
    const { height } = useElementSize(listRef)

    return (
        <nav
            id="page-sidebar"
            aria-label={t.sidebar.label}
            className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white p-3 transition-transform dark:border-neutral-800 dark:bg-neutral-900 md:static ${open ? 'translate-x-0' : '-translate-x-full md:hidden'}`}
        >
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {t.sidebar.title} <span className="font-mono text-xs">({pages.length})</span>
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => actions.addBlankPage('A4')}
                        aria-label={t.sidebar.addBlankLabel}
                        title={t.sidebar.addBlankLabel}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                        <Plus className="h-3 w-3" aria-hidden />
                        {t.sidebar.addBlank}
                    </button>
                    <button type="button" onClick={actions.toggleSidebar} aria-label={t.sidebar.close} className="rounded p-1 text-neutral-600 dark:text-neutral-400 md:hidden">
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </div>
            </div>
            <div ref={listRef} className="min-h-0 flex-1">
                {height > 0 && (
                    <FixedSizeList<RowData>
                        height={height}
                        width="100%"
                        itemCount={pages.length}
                        itemSize={ITEM_HEIGHT}
                        overscanCount={OVERSCAN}
                        itemData={{ pages, activePage, actions, t }}
                        itemKey={(index, data) => data.pages[index].id}
                        innerElementType={ListInner}
                        className="overscroll-contain"
                    >
                        {Row}
                    </FixedSizeList>
                )}
            </div>
        </nav>
    )
}

type RowData = { pages: PageRef[]; activePage: number; actions: DocActions; t: Messages }

const ListInner = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ListInner(props, ref) {
    return <div ref={ref} role="list" {...props} />
})

const Row = memo(function Row({ index, style, data }: ListChildComponentProps<RowData>) {
    const page = data.pages[index]
    const { t, actions } = data
    const count = data.pages.length
    const active = index === data.activePage
    const n = index + 1

    return (
        <div style={style} role="listitem" className="pb-3">
            <div className={`flex h-full flex-col rounded-lg border-2 p-2 transition-colors ${active ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'}`}>
                <button
                    type="button"
                    onClick={() => actions.setActivePage(index)}
                    aria-label={t.sidebar.page(n)}
                    aria-current={active ? 'page' : undefined}
                    className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                    <Thumbnail page={page} errorLabel={t.sidebar.thumbnailError} />
                </button>
                <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={`font-medium ${active ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-600 dark:text-neutral-400'}`}>{t.sidebar.page(n)}</span>
                    <div className="flex gap-0.5">
                        <RowButton label={t.sidebar.moveUp(n)} disabled={index === 0} onClick={() => actions.movePage(index, index - 1)}>
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        </RowButton>
                        <RowButton label={t.sidebar.moveDown(n)} disabled={index === count - 1} onClick={() => actions.movePage(index, index + 1)}>
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        </RowButton>
                        <RowButton label={t.sidebar.delete(n)} danger onClick={() => actions.deletePage(index)}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </RowButton>
                    </div>
                </div>
            </div>
        </div>
    )
})

function RowButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={`rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30 ${danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
        >
            {children}
        </button>
    )
}

/** Renders once per page reference; scrolling away aborts an in-flight render. */
const Thumbnail = memo(function Thumbnail({ page, errorLabel }: { page: PageRef; errorLabel: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const controller = new AbortController()
        setFailed(false)
        renderPage(page, canvas, { zoom: THUMBNAIL_ZOOM, signal: controller.signal, applyCssSize: false }).catch((error: unknown) => {
            if (!controller.signal.aborted && !isCancelled(error)) setFailed(true)
        })
        return () => controller.abort()
    }, [page])

    return (
        <>
            <canvas ref={canvasRef} className={`max-h-full max-w-full bg-white shadow-sm ${failed ? 'hidden' : ''}`} aria-hidden />
            {failed && <span className="text-xs text-neutral-600 dark:text-neutral-400">{errorLabel}</span>}
        </>
    )
})
