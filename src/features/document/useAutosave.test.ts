import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AUTOSAVE_DELAY_MS, useAutosave } from './useAutosave'
import { useDoc } from '../../store'
import { openPdfSource, releaseAllPdfSources } from '../../services/pdf'
import { loadSession, resetPersistenceConnection, saveSession } from '../../services/persistence/autosave'
import { createPdf, readFixture } from '../../test/pdfFixtures'

beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetPersistenceConnection()
})

afterEach(() => vi.useRealTimers())

describe('useAutosave', () => {
    it('saves document changes after a debounce', async () => {
        renderHook(() => useAutosave())
        const source = await openPdfSource(await createPdf([{}]), 'a.pdf')
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        act(() => useDoc.getState().actions.openDocument(source))
        act(() => useDoc.getState().actions.addBlankPage())
        expect(await loadSession()).toBeNull()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
        })
        vi.useRealTimers()
        await waitFor(async () => expect((await loadSession())?.session.pages).toHaveLength(2))
    })

    it('offers the stored session on startup and restores it', async () => {
        const bytes = await createPdf([{}, {}])
        await saveSession(
            {
                pages: [{ id: 'p1', kind: 'pdf', sourceKey: 'stored', index: 1 }],
                overlays: { p1: [{ type: 'checkbox', x: 0.1, y: 0.1, size: 0.03, checked: true }] },
                sources: [{ key: 'stored', name: 'stored.pdf', pageCount: 2, sizeBytes: bytes.byteLength, encrypted: false }],
                activePage: 0,
            },
            () => bytes
        )
        await releaseAllPdfSources()
        const { result } = renderHook(() => useAutosave())
        await waitFor(() => expect(result.current.candidate).not.toBeNull())

        await act(() => result.current.restore())
        expect(useDoc.getState().document.pages).toEqual([{ id: 'p1', kind: 'pdf', sourceKey: 'stored', index: 1 }])
        expect(useDoc.getState().document.overlays.p1).toHaveLength(1)
        expect(result.current.candidate).toBeNull()
    })

    it('discards the stored session on request', async () => {
        await saveSession({ pages: [{ id: 'b', kind: 'blank', format: 'A4' }], overlays: {}, sources: [], activePage: 0 }, () => new Uint8Array())
        const { result } = renderHook(() => useAutosave())
        await waitFor(() => expect(result.current.candidate).not.toBeNull())
        await act(() => result.current.discard())
        expect(await loadSession()).toBeNull()
    })

    it('never persists password-protected documents', async () => {
        renderHook(() => useAutosave())
        const source = await openPdfSource(readFixture('encrypted.pdf'), 'secret.pdf', { password: 'secret' })
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        act(() => useDoc.getState().actions.openDocument(source))
        act(() => useDoc.getState().actions.addBlankPage())
        await act(async () => {
            await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
        })
        vi.useRealTimers()
        expect(useDoc.getState().ui.notice).toMatch(/nicht automatisch gespeichert/)
        expect(await loadSession()).toBeNull()
    })
})
