import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useDoc } from '../store'
import { fileFromBytes, readFixture } from '../test/pdfFixtures'
import { createWebEngine, setAnalysisEngine } from '../services/analysis/engine'
import type * as RenderModule from '../services/pdf/render'

// jsdom cannot paint; the viewer only needs the page size from the renderer.
vi.mock('../services/pdf/render', async (importOriginal) => ({
    ...(await importOriginal<typeof RenderModule>()),
    renderPage: vi.fn(async () => ({ width: 595.28, height: 841.89 })),
}))

beforeAll(() => {
    // The virtualized sidebar only renders rows when its container has a height.
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 })
})

beforeEach(() => setAnalysisEngine(createWebEngine(null)))

const openFile = async (file: File, expectedPages?: number) => {
    await act(async () => {
        fireEvent.change(screen.getByTestId('open-pdf-input'), { target: { files: [file] } })
    })
    if (expectedPages !== undefined) await waitFor(() => expect(useDoc.getState().document.pages).toHaveLength(expectedPages))
}

/** Notices are rendered in the toast region (role="status", aria-live="polite"). */
const notice = () => document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement

describe('App', () => {
    it('shows the empty state with a skip link and disabled document actions', () => {
        render(<App />)
        expect(screen.getByText('PDF öffnen oder hierher ziehen, um zu starten.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Zum Dokument springen' })).toHaveAttribute('href', '#document-view')
        expect(screen.getByRole('button', { name: 'PDF exportieren (Strg+S)' })).toBeDisabled()
        expect(document.documentElement.lang).toBe('de')
    })

    it('opens a PDF, lists its pages and navigates between them', async () => {
        render(<App />)
        await openFile(fileFromBytes(readFixture('sample.pdf'), 'sample.pdf'), 3)
        const sidebar = screen.getByRole('navigation', { name: 'Seitenübersicht' })
        expect(within(sidebar).getAllByRole('listitem')).toHaveLength(3)

        fireEvent.click(within(sidebar).getByRole('button', { name: 'Seite 3' }))
        expect(useDoc.getState().viewer.activePage).toBe(2)
        expect(within(sidebar).getByRole('button', { name: 'Seite 3' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('img', { name: 'Seite 3 von 3' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Vorherige Seite' }))
        expect(useDoc.getState().viewer.activePage).toBe(1)
    })

    it('asks for the password of encrypted files and warns that export is unsupported', async () => {
        const user = userEvent.setup()
        render(<App />)
        await openFile(fileFromBytes(readFixture('encrypted.pdf'), 'secret.pdf'))

        const dialog = await screen.findByRole('dialog', { name: 'Passwortgeschütztes PDF' })
        await user.type(within(dialog).getByLabelText('Passwort'), 'wrong')
        await user.click(within(dialog).getByRole('button', { name: 'Entsperren' }))
        expect(await screen.findByText('Das Passwort ist falsch. Bitte erneut versuchen.')).toBeInTheDocument()

        await user.type(screen.getByLabelText('Passwort'), 'secret')
        await user.click(screen.getByRole('button', { name: 'Entsperren' }))
        await waitFor(() => expect(useDoc.getState().document.pages).toHaveLength(3))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(notice()).toHaveTextContent('Export wird nicht unterstützt')
    })

    it('rejects non-PDF files', async () => {
        render(<App />)
        await openFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
        expect(screen.getByRole('alert')).toHaveTextContent('Bitte eine PDF-Datei auswählen.')
    })

    it('exports the edited document and clears the unsaved flag', async () => {
        const createObjectURL = vi.fn((_blob: Blob) => 'blob:pdf')
        Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
        render(<App />)
        await openFile(fileFromBytes(readFixture('sample.pdf'), 'vertrag.pdf'), 3)
        act(() => useDoc.getState().actions.addBlankPage())
        expect(useDoc.getState().document.dirty).toBe(true)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'PDF exportieren (Strg+S)' }))
        })
        await waitFor(() => expect(click).toHaveBeenCalled())
        const blob = createObjectURL.mock.calls[0][0]
        expect(blob.type).toBe('application/pdf')
        expect(useDoc.getState().document.dirty).toBe(false)
        expect(notice()).toHaveTextContent('PDF exportiert.')
    })

    it('detects form fields as one undoable step', async () => {
        render(<App />)
        await openFile(fileFromBytes(readFixture('sample.pdf'), 'sample.pdf'), 3)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Formularfelder erkennen' }))
        })
        await waitFor(() => expect(notice()).toHaveTextContent(/Textfeld/))
        const count = Object.values(useDoc.getState().document.overlays).flat().length
        expect(count).toBeGreaterThanOrEqual(3)

        fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
        expect(Object.values(useDoc.getState().document.overlays).flat()).toHaveLength(0)
    })

    it('searches with Ctrl+F and highlights the current match', async () => {
        const user = userEvent.setup()
        render(<App />)
        await openFile(fileFromBytes(readFixture('sample.pdf'), 'sample.pdf'), 3)

        fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
        const input = screen.getByRole('searchbox', { name: 'Im Dokument suchen' })
        expect(input).toHaveFocus()
        await user.type(input, 'Frist')
        await waitFor(() => expect(useDoc.getState().search.matches).toHaveLength(2), { timeout: 2000 })
        expect(await screen.findByText('1 / 2')).toBeInTheDocument()
        expect(useDoc.getState().viewer.activePage).toBe(0)

        await user.keyboard('{Enter}')
        expect(useDoc.getState().viewer.activePage).toBe(2)

        await user.click(screen.getByLabelText('Regulärer Ausdruck'))
        await user.clear(input)
        await user.type(input, '(')
        await waitFor(() => expect(screen.getByText(/Ungültiger regulärer Ausdruck/)).toBeInTheDocument(), { timeout: 2000 })
    })

    it('switches the interface language', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.selectOptions(screen.getByRole('combobox', { name: 'Sprache' }), 'en')
        expect(screen.getByText('Open a PDF or drop it here to get started.')).toBeInTheDocument()
        expect(document.documentElement.lang).toBe('en')
    })

    it('opens dropped PDF files', async () => {
        render(<App />)
        const file = fileFromBytes(readFixture('sample.pdf'), 'dropped.pdf')
        const root = screen.getByRole('main').parentElement!
        fireEvent.dragOver(root, { dataTransfer: { types: ['Files'], files: [file] } })
        expect(screen.getByText('PDF loslassen zum Öffnen')).toBeInTheDocument()
        await act(async () => {
            fireEvent.drop(root, { dataTransfer: { types: ['Files'], files: [file] } })
        })
        await waitFor(() => expect(useDoc.getState().document.pages).toHaveLength(3))
    })
})
