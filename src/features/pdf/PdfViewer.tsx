import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useActivePage, useDoc, useDocActions, usePageShapes } from '../../store'
import { describeError, useT } from '../../i18n'
import { useElementSize } from '../../hooks/useElementSize'
import { usePdfRenderer } from './hooks/usePdfRenderer'
import { useFitZoom } from './hooks/useFitZoom'
import { usePdfKeyboardShortcuts } from './hooks/usePdfKeyboardShortcuts'
import { usePdfInteractions } from './hooks/usePdfInteractions'
import { usePdfTextLayer } from './hooks/usePdfTextLayer'
import PdfOverlays from './components/PdfOverlays'
import SelectionOverlay from './components/SelectionOverlay'
import TextEditorOverlay from './components/TextEditorOverlay'
import TextLayer from './components/TextLayer'
import SearchHighlights from './components/SearchHighlights'

export default function PdfViewer() {
    const t = useT()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const textAreaRef = useRef<HTMLTextAreaElement>(null)
    const helpId = useId()

    const { page, index: pageIndex, count: pageCount } = useActivePage()
    const shapes = usePageShapes(page?.id)
    const { zoom, fitMode, tool, activeColor, strokeWidth } = useDoc(useShallow((s) => s.viewer))
    const stampImage = useDoc((s) => s.document.stampImage)
    const textSettings = useDoc((s) => s.textSettings)
    const pageMatches = useDoc(useShallow((s) => s.search.matches.filter((m) => m.pageId === page?.id)))
    const currentMatch = useDoc((s) => s.search.matches[s.search.matchIndex])
    const actions = useDocActions()

    const { pageSize, error, isRendering } = usePdfRenderer({ canvasRef, page, zoom })
    // Measure the scroll container, not the content: the content grows with the zoom and would feed back into the fit.
    const viewportSize = useElementSize(wrapperRef)
    useFitZoom(fitMode, pageSize, viewportSize, zoom, actions.setZoomForFit)

    const interactions = usePdfInteractions({
        canvasRef,
        wrapperRef,
        textAreaRef,
        tool,
        pageId: page?.id,
        shapes,
        stampImage,
        textSettings,
        zoom,
        activeColor,
        strokeWidth,
        actions,
    })

    const reportError = useCallback((err: unknown) => actions.setError(describeError(err, t)), [actions, t])
    const textItems = usePdfTextLayer({ page, enabled: tool === 'text-select', onError: reportError })

    const { selectedIndex, setSelectedIndex, editing, commitTextEdit, beginTextEdit, handlers } = interactions
    const selectedShape = selectedIndex !== null ? shapes[selectedIndex] : null
    const editingShape = editing && editing.pageId === page?.id ? shapes[editing.index] : undefined

    usePdfKeyboardShortcuts(wrapperRef, {
        pagesCount: pageCount,
        activePage: pageIndex,
        shapesCount: shapes.length,
        selectedIndex,
        editing: Boolean(editing),
        setActivePage: actions.setActivePage,
        selectShape: setSelectedIndex,
        moveSelection: (dx, dy) => {
            if (page && selectedIndex !== null) actions.moveShape(page.id, selectedIndex, dx, dy)
        },
        deleteSelection: () => {
            if (!page || selectedIndex === null) return
            actions.removeShape(page.id, selectedIndex)
            setSelectedIndex(null)
        },
        editSelection: () => {
            if (selectedIndex !== null) beginTextEdit(selectedIndex)
        },
        commitEdit: commitTextEdit,
    })

    // React registers wheel listeners as passive; ctrl+wheel zoom needs preventDefault.
    const onWheel = handlers.onWheel
    useEffect(() => {
        const wrapper = wrapperRef.current
        if (!wrapper) return
        wrapper.addEventListener('wheel', onWheel, { passive: false })
        return () => wrapper.removeEventListener('wheel', onWheel)
    }, [onWheel])

    // Bring the current search hit into view.
    useEffect(() => {
        const wrapper = wrapperRef.current
        const canvas = canvasRef.current
        if (!wrapper || !canvas || !currentMatch || currentMatch.pageId !== page?.id || !pageSize) return
        const canvasRect = canvas.getBoundingClientRect()
        const wrapperRect = wrapper.getBoundingClientRect()
        const top = canvasRect.top - wrapperRect.top + wrapper.scrollTop + currentMatch.y * canvasRect.height
        wrapper.scrollTo({ top: Math.max(0, top - wrapper.clientHeight / 3), behavior: 'smooth' })
    }, [currentMatch, page?.id, pageSize])

    const selectionAnnouncement = useMemo(() => {
        if (!selectedShape || selectedIndex === null) return ''
        return t.viewer.selected(t.viewer.shapeNames[selectedShape.type] ?? selectedShape.type, selectedIndex + 1, shapes.length)
    }, [selectedShape, selectedIndex, shapes.length, t])

    const isPanning = tool === 'pan' || interactions.mode === 'panning' || interactions.mode === 'pinching'
    const cursorClass = tool === 'text-select' ? 'cursor-text' : isPanning ? 'cursor-grab' : tool === 'select' ? '' : 'cursor-crosshair'
    const currentIndexOnPage = currentMatch ? pageMatches.indexOf(currentMatch) : -1

    return (
        <section
            ref={wrapperRef}
            id="document-view"
            aria-label={t.viewer.label}
            aria-describedby={helpId}
            tabIndex={0}
            className={`relative min-h-0 flex-1 overflow-auto overscroll-contain bg-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:bg-neutral-950 ${cursorClass}`}
        >
            <p id={helpId} className="sr-only">{t.viewer.keyboardHelp}</p>
            <p className="sr-only" aria-live="polite">{selectionAnnouncement}</p>

            <div className="flex min-h-full items-center justify-center p-4">
                {page ? (
                    <div className="relative inline-block rounded-sm bg-white shadow-lg ring-1 ring-black/5">
                        <canvas
                            ref={canvasRef}
                            className="block touch-none select-none"
                            role="img"
                            aria-label={t.viewer.pageLabel(pageIndex + 1, pageCount)}
                            onPointerDown={handlers.onPointerDown}
                            onPointerMove={handlers.onPointerMove}
                            onPointerUp={handlers.onPointerUp}
                            onPointerCancel={handlers.onPointerCancel}
                            onDoubleClick={handlers.onDoubleClick}
                        />
                        {pageSize && (
                            <div className="pointer-events-none absolute inset-0">
                                <SearchHighlights matches={pageMatches} currentIndex={currentIndexOnPage} label={t.viewer.searchHit} />
                                <TextLayer items={textItems} zoom={zoom} enabled={tool === 'text-select'} />
                                <PdfOverlays
                                    shapes={shapes}
                                    tempShape={interactions.tempShape}
                                    editingIndex={editingShape?.type === 'text' ? editing!.index : null}
                                    zoom={zoom}
                                    pageSize={pageSize}
                                />
                                {selectedShape && (tool === 'select' || tool === 'pan') && !editingShape && <SelectionOverlay shape={selectedShape} />}
                                {editingShape?.type === 'text' && (
                                    <TextEditorOverlay
                                        shape={editingShape}
                                        placeholder={t.viewer.textPlaceholder}
                                        label={t.viewer.editText}
                                        zoom={zoom}
                                        value={interactions.editingValue}
                                        onChange={interactions.setEditingValue}
                                        onCommit={commitTextEdit}
                                        textAreaRef={textAreaRef}
                                    />
                                )}
                            </div>
                        )}
                        {error !== null && (
                            <div role="alert" className="absolute inset-0 flex items-center justify-center bg-red-50/95 p-6 text-center text-sm text-red-700 dark:bg-red-950/90 dark:text-red-200">
                                {describeError(error, t)}
                            </div>
                        )}
                        {isRendering && !pageSize && <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-600 dark:text-neutral-400">{t.viewer.rendering}</p>}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-8 py-10 text-center dark:border-neutral-700 dark:bg-neutral-900/60">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.app.emptyState}</p>
                    </div>
                )}
            </div>

            {pageCount > 0 && (
                <div className="pointer-events-none sticky bottom-4 left-0 flex justify-center" aria-hidden>
                    <span className="rounded-full bg-black/70 px-3 py-1 text-sm text-white">{t.viewer.pageLabel(pageIndex + 1, pageCount)}</span>
                </div>
            )}
        </section>
    )
}
