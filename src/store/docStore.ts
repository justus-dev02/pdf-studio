import { create } from 'zustand'
import { original } from 'immer'
import { immer } from 'zustand/middleware/immer'
import type {
    FitMode,
    PageId,
    PageOverlays,
    PageRef,
    PaperDimensions,
    PaperFormat,
    SearchMatch,
    Shape,
    SourceKey,
    SourceMeta,
    TextBox,
    TextFont,
    Tool,
} from '../types'
import type { Locale } from '../i18n'
import { clamp } from '../lib/geometry'
import { translateShape } from '../lib/shapes'

export type TextSettings = { fontFamily: TextFont; fontSize: number }

/** What undo/redo restores. Zoom and tool are view state and intentionally not part of history. */
export type HistoryEntry = {
    pages: PageRef[]
    overlays: PageOverlays
    activePage: number
}

export const HISTORY_LIMIT = 100
export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 6
export const FONT_SIZE_MIN = 6
export const FONT_SIZE_MAX = 72

/** Options for document mutations; `record: false` skips the undo entry (used for continuous edits). */
export type ChangeOptions = { record?: boolean }

export type DocStore = {
    document: {
        pages: PageRef[]
        overlays: PageOverlays
        sources: Record<SourceKey, SourceMeta>
        stampImage?: string
        /** True when there are changes that have not been exported. */
        dirty: boolean
    }
    viewer: {
        zoom: number
        fitMode: FitMode
        activePage: number
        tool: Tool
        activeColor: string
        strokeWidth: number
    }
    search: {
        query: string
        caseSensitive: boolean
        regex: boolean
        matches: SearchMatch[]
        matchIndex: number
        isSearching: boolean
    }
    ui: {
        dark: boolean
        sidebarOpen: boolean
        locale: Locale
        error?: string
        notice?: string
    }
    textSettings: TextSettings
    history: {
        undo: HistoryEntry[]
        redo: HistoryEntry[]
    }
    actions: DocActions
}

export type DocActions = {
    setTool: (tool: Tool) => void
    setActiveColor: (color: string) => void
    setStrokeWidth: (width: number) => void
    setZoom: (zoom: number) => void
    setZoomForFit: (zoom: number) => void
    setFitMode: (mode: FitMode) => void
    toggleDark: () => void
    toggleSidebar: () => void
    setLocale: (locale: Locale) => void
    setActivePage: (index: number) => void
    setError: (message?: string) => void
    setNotice: (message?: string) => void

    openDocument: (source: SourceMeta) => void
    appendSource: (source: SourceMeta) => void
    addBlankPage: (format?: PaperFormat, customDimensions?: PaperDimensions) => void
    movePage: (from: number, to: number) => void
    deletePage: (index: number) => void
    restoreSession: (session: { pages: PageRef[]; overlays: PageOverlays; sources: SourceMeta[]; activePage: number }) => void
    markSaved: () => void

    pushOverlay: (pageId: PageId, shape: Shape, options?: ChangeOptions) => void
    addShapes: (entries: { pageId: PageId; shape: Shape }[]) => void
    replaceOverlays: (pageId: PageId, shapes: Shape[], options?: ChangeOptions) => void
    moveShape: (pageId: PageId, shapeIndex: number, dx: number, dy: number, options?: ChangeOptions) => void
    updateShape: (pageId: PageId, shapeIndex: number, next: Shape, options?: ChangeOptions) => void
    removeShape: (pageId: PageId, shapeIndex: number, options?: ChangeOptions) => void
    setStampImage: (dataUrl: string | undefined) => void
    setTextSettings: (settings: Partial<TextSettings>) => void

    setSearchQuery: (query: string) => void
    setSearchOptions: (options: Partial<{ caseSensitive: boolean; regex: boolean }>) => void
    /** `navigate: false` keeps the current page (used when results are refreshed after page edits). */
    setSearchMatches: (matches: SearchMatch[], options?: { navigate?: boolean }) => void
    nextSearchMatch: () => void
    prevSearchMatch: () => void
    setIsSearching: (value: boolean) => void

    /** Records the current state as one undo step. Call once before a continuous edit (drag, resize, typing). */
    snapshot: () => void
    undo: () => void
    redo: () => void
    reset: () => void
}

export const createPageId = (): PageId =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export const pagesForSource = (source: SourceMeta): PageRef[] =>
    Array.from({ length: source.pageCount }, (_, index) => ({ id: createPageId(), kind: 'pdf' as const, sourceKey: source.key, index }))

export const getDefaultTextShape = (settings: TextSettings, color = '#111827'): TextBox => ({
    type: 'text',
    x: 0.1,
    y: 0.1,
    w: 0.25,
    h: 0.08,
    text: '',
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    color,
})

const createInitialState = (): Omit<DocStore, 'actions'> => ({
    document: { pages: [], overlays: {}, sources: {}, stampImage: undefined, dirty: false },
    viewer: { zoom: 1, fitMode: 'width', activePage: 0, tool: 'select', activeColor: '#eab308', strokeWidth: 0.003 },
    search: { query: '', caseSensitive: false, regex: false, matches: [], matchIndex: 0, isSearching: false },
    ui: { dark: false, sidebarOpen: true, locale: 'de', error: undefined, notice: undefined },
    textSettings: { fontFamily: 'Helvetica', fontSize: 14 },
    history: { undo: [], redo: [] },
})

/**
 * Immer state is immutable, so a history entry can reference the current (frozen)
 * page and overlay objects directly. `original()` returns them without copying;
 * unchanged pages are shared between all entries (structural sharing).
 */
const captureHistory = (state: DocStore): HistoryEntry => ({
    pages: original(state.document.pages) ?? state.document.pages,
    overlays: original(state.document.overlays) ?? state.document.overlays,
    activePage: state.viewer.activePage,
})

const record = (state: DocStore, options?: ChangeOptions) => {
    state.document.dirty = true
    if (options?.record === false) return
    state.history.undo.push(captureHistory(state))
    if (state.history.undo.length > HISTORY_LIMIT) state.history.undo.splice(0, state.history.undo.length - HISTORY_LIMIT)
    state.history.redo = []
}

const applyHistory = (state: DocStore, entry: HistoryEntry) => {
    state.document.pages = entry.pages
    state.document.overlays = entry.overlays
    state.viewer.activePage = clamp(entry.activePage, 0, Math.max(0, entry.pages.length - 1))
    state.document.dirty = true
}

const clearSearch = (state: DocStore) => {
    state.search.matches = []
    state.search.matchIndex = 0
}

const shapesOf = (state: DocStore, pageId: PageId) => state.document.overlays[pageId]

export const useDoc = create<DocStore>()(
    immer((set) => ({
        ...createInitialState(),
        actions: {
            setTool: (tool) => set((state) => { state.viewer.tool = tool }),
            setActiveColor: (color) => set((state) => { state.viewer.activeColor = color }),
            setStrokeWidth: (width) => set((state) => { state.viewer.strokeWidth = width }),
            setZoom: (zoom) => set((state) => {
                state.viewer.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX)
                state.viewer.fitMode = 'manual'
            }),
            setZoomForFit: (zoom) => set((state) => { state.viewer.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX) }),
            setFitMode: (mode) => set((state) => { state.viewer.fitMode = mode }),
            toggleDark: () => set((state) => { state.ui.dark = !state.ui.dark }),
            toggleSidebar: () => set((state) => { state.ui.sidebarOpen = !state.ui.sidebarOpen }),
            setLocale: (locale) => set((state) => { state.ui.locale = locale }),
            setActivePage: (index) => set((state) => {
                state.viewer.activePage = clamp(index, 0, Math.max(0, state.document.pages.length - 1))
            }),
            setError: (message) => set((state) => { state.ui.error = message }),
            setNotice: (message) => set((state) => { state.ui.notice = message }),

            openDocument: (source) => set((state) => {
                state.document.sources = { [source.key]: source }
                state.document.pages = pagesForSource(source)
                state.document.overlays = {}
                state.document.dirty = false
                state.viewer.activePage = 0
                state.viewer.fitMode = 'width'
                state.history = { undo: [], redo: [] }
                clearSearch(state)
            }),
            appendSource: (source) => set((state) => {
                record(state)
                state.document.sources[source.key] = source
                state.document.pages.push(...pagesForSource(source))
                clearSearch(state)
            }),
            addBlankPage: (format = 'A4', customDimensions) => set((state) => {
                record(state)
                state.document.pages.push({ id: createPageId(), kind: 'blank', format, customDimensions })
            }),
            movePage: (from, to) => set((state) => {
                const pages = state.document.pages
                if (from === to || from < 0 || from >= pages.length || to < 0 || to >= pages.length) return
                record(state)
                const [moved] = pages.splice(from, 1)
                pages.splice(to, 0, moved)
                state.viewer.activePage = to
                clearSearch(state)
            }),
            deletePage: (index) => set((state) => {
                const pages = state.document.pages
                if (index < 0 || index >= pages.length) return
                record(state)
                const [removed] = pages.splice(index, 1)
                delete state.document.overlays[removed.id]
                state.viewer.activePage = clamp(state.viewer.activePage, 0, Math.max(0, pages.length - 1))
                clearSearch(state)
            }),
            restoreSession: (session) => set((state) => {
                state.document.sources = Object.fromEntries(session.sources.map((s) => [s.key, s]))
                state.document.pages = session.pages
                state.document.overlays = session.overlays
                state.document.dirty = true
                state.viewer.activePage = clamp(session.activePage, 0, Math.max(0, session.pages.length - 1))
                state.history = { undo: [], redo: [] }
                clearSearch(state)
            }),
            markSaved: () => set((state) => { state.document.dirty = false }),

            pushOverlay: (pageId, shape, options) => set((state) => {
                record(state, options)
                ;(state.document.overlays[pageId] ??= []).push(shape)
            }),
            addShapes: (entries) => set((state) => {
                if (entries.length === 0) return
                record(state)
                for (const { pageId, shape } of entries) (state.document.overlays[pageId] ??= []).push(shape)
            }),
            replaceOverlays: (pageId, shapes, options) => set((state) => {
                record(state, options)
                state.document.overlays[pageId] = shapes
            }),
            moveShape: (pageId, shapeIndex, dx, dy, options) => set((state) => {
                const shapes = shapesOf(state, pageId)
                if (!shapes?.[shapeIndex]) return
                record(state, options)
                shapes[shapeIndex] = translateShape(shapes[shapeIndex], dx, dy)
            }),
            updateShape: (pageId, shapeIndex, next, options = { record: false }) => set((state) => {
                const shapes = shapesOf(state, pageId)
                if (!shapes?.[shapeIndex]) return
                record(state, options)
                shapes[shapeIndex] = next
            }),
            removeShape: (pageId, shapeIndex, options) => set((state) => {
                const shapes = shapesOf(state, pageId)
                if (!shapes?.[shapeIndex]) return
                record(state, options)
                shapes.splice(shapeIndex, 1)
            }),
            setStampImage: (dataUrl) => set((state) => { state.document.stampImage = dataUrl }),
            setTextSettings: (settings) => set((state) => {
                const next = { ...state.textSettings, ...settings }
                next.fontSize = clamp(Number.isFinite(next.fontSize) ? next.fontSize : 14, FONT_SIZE_MIN, FONT_SIZE_MAX)
                state.textSettings = next
            }),

            setSearchQuery: (query) => set((state) => { state.search.query = query }),
            setSearchOptions: (options) => set((state) => { Object.assign(state.search, options) }),
            setSearchMatches: (matches, options) => set((state) => {
                state.search.matches = matches
                state.search.matchIndex = 0
                if (matches.length > 0 && options?.navigate !== false) state.viewer.activePage = matches[0].pageIndex
            }),
            nextSearchMatch: () => set((state) => {
                const count = state.search.matches.length
                if (count === 0) return
                state.search.matchIndex = (state.search.matchIndex + 1) % count
                state.viewer.activePage = state.search.matches[state.search.matchIndex].pageIndex
            }),
            prevSearchMatch: () => set((state) => {
                const count = state.search.matches.length
                if (count === 0) return
                state.search.matchIndex = (state.search.matchIndex - 1 + count) % count
                state.viewer.activePage = state.search.matches[state.search.matchIndex].pageIndex
            }),
            setIsSearching: (value) => set((state) => { state.search.isSearching = value }),

            snapshot: () => set((state) => { record(state) }),
            undo: () => set((state) => {
                const previous = state.history.undo.pop()
                if (!previous) return
                state.history.redo.push(captureHistory(state))
                applyHistory(state, previous)
                clearSearch(state)
            }),
            redo: () => set((state) => {
                const next = state.history.redo.pop()
                if (!next) return
                state.history.undo.push(captureHistory(state))
                applyHistory(state, next)
                clearSearch(state)
            }),
            reset: () => set((state) => ({ ...createInitialState(), ui: { ...createInitialState().ui, locale: state.ui.locale, dark: state.ui.dark } })),
        },
    }))
)
