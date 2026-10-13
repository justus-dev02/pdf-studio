import { describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning'
import RestoreBanner from './RestoreBanner'
import { useDocumentCommands } from './DocumentCommands'
import { useDoc } from '../../store'

describe('useUnsavedChangesWarning', () => {
    it('blocks closing the tab only while there are unexported changes', () => {
        renderHook(() => useUnsavedChangesWarning('Wirklich verlassen?'))
        const clean = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(clean)
        expect(clean.defaultPrevented).toBe(false)

        act(() => useDoc.getState().actions.addBlankPage())
        const dirty = new Event('beforeunload', { cancelable: true })
        window.dispatchEvent(dirty)
        expect(dirty.defaultPrevented).toBe(true)
    })
})

describe('RestoreBanner', () => {
    it('describes the stored session and offers restore or discard', async () => {
        const user = userEvent.setup()
        const onRestore = vi.fn()
        const onDiscard = vi.fn()
        const candidate = { session: { schemaVersion: 1, savedAt: Date.now() - 5 * 60_000, pages: [{ id: 'a', kind: 'blank' as const, format: 'A4' as const }], overlays: {}, sources: [], activePage: 0 }, bytes: new Map() }
        render(<RestoreBanner candidate={candidate} onRestore={onRestore} onDiscard={onDiscard} />)
        expect(screen.getByRole('region', { name: 'Letzte Sitzung gefunden' })).toHaveTextContent('1 Seite, zuletzt gespeichert vor 5 Min.')
        await user.click(screen.getByRole('button', { name: 'Wiederherstellen' }))
        await user.click(screen.getByRole('button', { name: 'Verwerfen' }))
        expect(onRestore).toHaveBeenCalled()
        expect(onDiscard).toHaveBeenCalled()
    })
})

describe('useDocumentCommands', () => {
    it('fails loudly outside of its provider', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        expect(() => renderHook(() => useDocumentCommands())).toThrow(/DocumentCommandsContext/)
    })
})
