import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toolbar from './Toolbar'
import { readImageAsDataUrl } from './images'
import { DocumentCommandsContext } from '../document/DocumentCommands'
import { useDoc } from '../../store'

const commands = { load: vi.fn(async () => undefined), isLoading: false, exportDocument: vi.fn(async () => undefined), isExporting: false }
const renderToolbar = () =>
    render(
        <DocumentCommandsContext.Provider value={commands}>
            <Toolbar />
        </DocumentCommandsContext.Provider>
    )
const withPages = () => act(() => useDoc.getState().actions.restoreSession({ pages: [{ id: 'a', kind: 'blank', format: 'A4' }], overlays: {}, sources: [], activePage: 0 }))

describe('Toolbar', () => {
    it('exposes tools as labelled toggle buttons', async () => {
        const user = userEvent.setup()
        renderToolbar()
        const pen = screen.getByRole('button', { name: 'Stift' })
        expect(pen).toHaveAttribute('aria-pressed', 'false')
        await user.click(pen)
        expect(useDoc.getState().viewer.tool).toBe('pen')
        expect(pen).toHaveAttribute('aria-pressed', 'true')
    })

    it('selects colors as a radio group', async () => {
        const user = userEvent.setup()
        renderToolbar()
        await user.click(screen.getByRole('radio', { name: 'Rot' }))
        expect(useDoc.getState().viewer.activeColor).toBe('#ef4444')
        expect(screen.getByRole('radio', { name: 'Rot' })).toHaveAttribute('aria-checked', 'true')
    })

    it('changes text settings, zoom and fit mode', async () => {
        const user = userEvent.setup()
        renderToolbar()
        await user.selectOptions(screen.getByRole('combobox', { name: 'Schriftart' }), 'Courier')
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Schriftgröße' }), { target: { value: '20' } })
        expect(useDoc.getState().textSettings).toEqual({ fontFamily: 'Courier', fontSize: 20 })

        act(() => useDoc.getState().actions.setZoom(1))
        await user.click(screen.getByRole('button', { name: 'Vergrößern' }))
        expect(useDoc.getState().viewer.zoom).toBeCloseTo(1.2)
        await user.click(screen.getByRole('button', { name: 'Ganze Seite' }))
        expect(useDoc.getState().viewer.fitMode).toBe('page')
    })

    it('adds blank pages and enables undo/redo', async () => {
        const user = userEvent.setup()
        withPages()
        renderToolbar()
        expect(screen.getByRole('button', { name: 'Rückgängig (Strg+Z)' })).toBeDisabled()
        await user.selectOptions(screen.getByRole('combobox', { name: 'Leere Seite einfügen' }), 'A3')
        expect(useDoc.getState().document.pages.at(-1)).toMatchObject({ kind: 'blank', format: 'A3' })
        await user.click(screen.getByRole('button', { name: 'Rückgängig (Strg+Z)' }))
        expect(useDoc.getState().document.pages).toHaveLength(1)
        await user.click(screen.getByRole('button', { name: 'Wiederholen (Strg+Umschalt+Z)' }))
        expect(useDoc.getState().document.pages).toHaveLength(2)
    })

    it('handles global shortcuts for export, zoom and redo', () => {
        withPages()
        renderToolbar()
        act(() => useDoc.getState().actions.setZoom(1))
        fireEvent.keyDown(window, { key: 's', ctrlKey: true })
        expect(commands.exportDocument).toHaveBeenCalled()
        fireEvent.keyDown(window, { key: '+', metaKey: true })
        expect(useDoc.getState().viewer.zoom).toBeCloseTo(1.1)
        fireEvent.keyDown(window, { key: '-', ctrlKey: true })
        expect(useDoc.getState().viewer.zoom).toBeCloseTo(1)
        act(() => useDoc.getState().actions.addBlankPage())
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
        fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
        expect(useDoc.getState().document.pages).toHaveLength(2)
    })

    it('toggles theme and sidebar and opens the assistant lazily', async () => {
        const user = userEvent.setup()
        renderToolbar()
        await user.click(screen.getByRole('button', { name: 'Dunkles Design' }))
        expect(useDoc.getState().ui.dark).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Seitenleiste ein-/ausblenden' }))
        expect(useDoc.getState().ui.sidebarOpen).toBe(false)
        await user.click(screen.getByRole('button', { name: 'Analyse & KI' }))
        expect(await screen.findByRole('dialog', { name: 'Analyse & KI' })).toBeInTheDocument()
    })

    it('loads a stamp image and switches to the stamp tool', async () => {
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 10, height: 10, close: vi.fn() })))
        renderToolbar()
        const input = document.querySelector('input[accept^="image/png"]') as HTMLInputElement
        await act(async () => {
            fireEvent.change(input, { target: { files: [new File(['x'], 'stamp.png', { type: 'image/png' })] } })
        })
        await waitFor(() => expect(useDoc.getState().viewer.tool).toBe('stamp'))
        expect(useDoc.getState().document.stampImage).toMatch(/^data:image\/png/)
        vi.unstubAllGlobals()
    })
})

describe('readImageAsDataUrl', () => {
    it('re-encodes formats PDF cannot embed and rejects non-images', async () => {
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 1000, close: vi.fn() })))
        const drawImage = vi.fn()
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,RE')

        expect(await readImageAsDataUrl(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe('data:image/png;base64,RE')
        const [, , , width, height] = drawImage.mock.calls[0]
        expect([width, height]).toEqual([1600, 400])
        await expect(readImageAsDataUrl(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow()
        vi.unstubAllGlobals()
    })
})
