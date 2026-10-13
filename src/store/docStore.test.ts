import { beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, useDoc, ZOOM_MAX } from './docStore'
import type { SearchMatch, Shape, SourceMeta } from '../types'

const source = (key: string, pageCount: number): SourceMeta => ({ key, name: `${key}.pdf`, pageCount, sizeBytes: 100, encrypted: false })
const box = (x: number): Shape => ({ type: 'checkbox', x, y: 0.1, size: 0.03, checked: true })
const state = () => useDoc.getState()
const actions = () => useDoc.getState().actions
const pageIds = () => state().document.pages.map((p) => p.id)

beforeEach(() => actions().reset())

describe('document lifecycle', () => {
    it('opens a document with stable, unique page ids and no binary data in the store', () => {
        actions().openDocument(source('a', 3))
        const { pages, sources, dirty } = state().document
        expect(pages).toHaveLength(3)
        expect(new Set(pageIds()).size).toBe(3)
        expect(pages[1]).toMatchObject({ kind: 'pdf', sourceKey: 'a', index: 1 })
        expect(Object.keys(sources)).toEqual(['a'])
        expect(dirty).toBe(false)
        expect(JSON.stringify(state().document)).not.toMatch(/ArrayBuffer|Uint8Array/)
    })

    it('appends sources and blank pages as undoable steps', () => {
        actions().openDocument(source('a', 1))
        actions().appendSource(source('b', 2))
        actions().addBlankPage('Letter')
        expect(state().document.pages.map((p) => (p.kind === 'pdf' ? `${p.sourceKey}${p.index}` : p.format))).toEqual(['a0', 'b0', 'b1', 'Letter'])
        expect(state().history.undo).toHaveLength(2)
        expect(state().document.dirty).toBe(true)

        actions().undo()
        actions().undo()
        expect(state().document.pages).toHaveLength(1)
    })

    it('restores a saved session and keeps preferences on reset', () => {
        actions().setLocale('en')
        actions().toggleDark()
        actions().restoreSession({ pages: [{ id: 'x', kind: 'blank', format: 'A4' }], overlays: { x: [box(0.5)] }, sources: [], activePage: 7 })
        expect(state().viewer.activePage).toBe(0)
        expect(state().document.overlays.x).toHaveLength(1)

        actions().reset()
        expect(state().document.pages).toEqual([])
        expect(state().ui).toMatchObject({ locale: 'en', dark: true })
    })
})

describe('page operations keep annotations attached to their page', () => {
    beforeEach(() => {
        actions().openDocument(source('a', 3))
        const [p0, p1, p2] = pageIds()
        actions().pushOverlay(p0, box(0.1))
        actions().pushOverlay(p1, box(0.2))
        actions().pushOverlay(p2, box(0.3))
    })

    it('moves a page together with its overlays', () => {
        const [p0, p1, p2] = pageIds()
        actions().movePage(0, 2)
        expect(pageIds()).toEqual([p1, p2, p0])
        expect(state().document.overlays[p0]).toEqual([box(0.1)])
        expect(state().viewer.activePage).toBe(2)
    })

    it('deletes a page and its overlays only', () => {
        const [p0, p1, p2] = pageIds()
        actions().setActivePage(2)
        actions().deletePage(1)
        expect(pageIds()).toEqual([p0, p2])
        expect(state().document.overlays[p1]).toBeUndefined()
        expect(state().document.overlays[p2]).toEqual([box(0.3)])
        expect(state().viewer.activePage).toBe(1)
    })

    it('ignores invalid indices', () => {
        const before = state().document
        actions().movePage(0, 9)
        actions().movePage(1, 1)
        actions().deletePage(-1)
        expect(state().document).toBe(before)
    })

    it('undoes a move including the overlay mapping', () => {
        const before = state().document.overlays
        const order = pageIds()
        actions().movePage(2, 0)
        actions().undo()
        expect(pageIds()).toEqual(order)
        expect(state().document.overlays).toBe(before)
        actions().redo()
        expect(pageIds()[0]).toBe(order[2])
    })
})

describe('shape editing', () => {
    let pageId: string
    beforeEach(() => {
        actions().openDocument(source('a', 1))
        pageId = pageIds()[0]
    })

    it('records discrete edits and skips history for continuous updates', () => {
        actions().pushOverlay(pageId, box(0.1))
        actions().snapshot()
        actions().updateShape(pageId, 0, box(0.2))
        actions().updateShape(pageId, 0, box(0.3))
        expect(state().history.undo).toHaveLength(2)

        actions().undo()
        expect(state().document.overlays[pageId]).toEqual([box(0.1)])
    })

    it('moves, removes and batch-adds shapes', () => {
        actions().pushOverlay(pageId, box(0.1))
        actions().moveShape(pageId, 0, 0.1, 0)
        expect((state().document.overlays[pageId][0] as { x: number }).x).toBeCloseTo(0.2)

        actions().addShapes([
            { pageId, shape: box(0.5) },
            { pageId, shape: box(0.6) },
        ])
        expect(state().document.overlays[pageId]).toHaveLength(3)
        actions().undo()
        expect(state().document.overlays[pageId]).toHaveLength(1)

        actions().removeShape(pageId, 0, { record: false })
        expect(state().document.overlays[pageId]).toEqual([])
        actions().removeShape(pageId, 5)
        actions().updateShape('missing', 0, box(0))
    })
})

describe('history', () => {
    it('is capped at HISTORY_LIMIT entries', () => {
        actions().openDocument(source('a', 1))
        for (let i = 0; i < HISTORY_LIMIT + 25; i++) actions().addBlankPage()
        expect(state().history.undo).toHaveLength(HISTORY_LIMIT)
    })

    it('shares unchanged data between entries instead of copying it', () => {
        actions().openDocument(source('a', 2))
        const pagesBefore = state().document.pages
        actions().pushOverlay(pageIds()[0], box(0.1))
        expect(state().history.undo[0].pages).toBe(pagesBefore)
    })

    it('clears redo on new changes and ignores empty stacks', () => {
        actions().openDocument(source('a', 1))
        actions().undo()
        actions().redo()
        actions().addBlankPage()
        actions().undo()
        expect(state().history.redo).toHaveLength(1)
        actions().addBlankPage()
        expect(state().history.redo).toHaveLength(0)
    })

    it('tracks unsaved changes until export', () => {
        actions().openDocument(source('a', 1))
        actions().addBlankPage()
        expect(state().document.dirty).toBe(true)
        actions().markSaved()
        expect(state().document.dirty).toBe(false)
    })
})

describe('viewer and search', () => {
    const match = (pageIndex: number): SearchMatch => ({ pageId: `p${pageIndex}`, pageIndex, text: 'x', x: 0, y: 0, width: 0.1, height: 0.1 })

    it('clamps zoom, page and font size', () => {
        actions().openDocument(source('a', 2))
        actions().setZoom(100)
        expect(state().viewer).toMatchObject({ zoom: ZOOM_MAX, fitMode: 'manual' })
        actions().setActivePage(10)
        expect(state().viewer.activePage).toBe(1)
        actions().setTextSettings({ fontSize: 500 })
        expect(state().textSettings.fontSize).toBe(72)
        actions().setTextSettings({ fontSize: Number.NaN })
        expect(state().textSettings.fontSize).toBe(14)
    })

    it('navigates through matches cyclically and can refresh without jumping', () => {
        actions().openDocument(source('a', 3))
        actions().setSearchMatches([match(1), match(2)])
        expect(state().viewer.activePage).toBe(1)
        actions().nextSearchMatch()
        expect(state().viewer.activePage).toBe(2)
        actions().nextSearchMatch()
        expect(state().search.matchIndex).toBe(0)
        actions().prevSearchMatch()
        expect(state().search.matchIndex).toBe(1)

        actions().setActivePage(0)
        actions().setSearchMatches([match(2)], { navigate: false })
        expect(state().viewer.activePage).toBe(0)
    })

    it('clears stale matches when pages change', () => {
        actions().openDocument(source('a', 2))
        actions().setSearchMatches([match(1)])
        actions().deletePage(0)
        expect(state().search.matches).toEqual([])
    })

    it('updates simple view settings', () => {
        actions().setTool('pen')
        actions().setActiveColor('#ef4444')
        actions().setStrokeWidth(0.01)
        actions().setFitMode('page')
        actions().setZoomForFit(2)
        actions().toggleSidebar()
        actions().setError('e')
        actions().setNotice('n')
        actions().setStampImage('data:image/png;base64,AA==')
        actions().setSearchQuery('q')
        actions().setSearchOptions({ regex: true })
        actions().setIsSearching(true)
        expect(state().viewer).toMatchObject({ tool: 'pen', activeColor: '#ef4444', strokeWidth: 0.01, fitMode: 'page', zoom: 2 })
        expect(state().ui).toMatchObject({ sidebarOpen: false, error: 'e', notice: 'n' })
        expect(state().search).toMatchObject({ query: 'q', regex: true, isSearching: true })
    })
})
