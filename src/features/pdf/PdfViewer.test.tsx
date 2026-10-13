import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PdfViewer from './PdfViewer'
import { useDoc } from '../../store'
import { PdfError } from '../../services/pdf'
import * as render$ from '../../services/pdf/render'
import * as text$ from '../../services/pdf/text'
import type { Shape } from '../../types'

const box: Shape = { type: 'checkbox', x: 0.1, y: 0.1, size: 0.03, checked: true }
const note: Shape = { type: 'text', x: 0.5, y: 0.5, w: 0.3, h: 0.1, text: 'Notiz', fontSize: 12, fontFamily: 'Helvetica' }

function setup(shapes: Shape[] = [box, note]) {
    vi.spyOn(render$, 'renderPage').mockResolvedValue({ width: 600, height: 800 })
    const { actions } = useDoc.getState()
    act(() => {
        actions.restoreSession({ pages: [{ id: 'p1', kind: 'blank', format: 'A4' }, { id: 'p2', kind: 'blank', format: 'A4' }], overlays: { p1: shapes }, sources: [], activePage: 0 })
    })
    render(<PdfViewer />)
    return screen.getByRole('region', { name: 'Dokumentansicht' })
}

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 800, right: 600, bottom: 800, x: 0, y: 0, toJSON: () => ({}) })
})

describe('PdfViewer', () => {
    it('labels the page and explains the keyboard controls', async () => {
        const view = setup()
        expect(await screen.findByRole('img', { name: 'Seite 1 von 2' })).toBeInTheDocument()
        expect(view).toHaveAccessibleDescription(/Pfeiltasten verschieben/)
        expect(view).toHaveAttribute('tabindex', '0')
    })

    it('selects, moves and deletes annotations with the keyboard, announcing the selection', async () => {
        const view = setup()
        await screen.findByRole('img', { name: 'Seite 1 von 2' })

        fireEvent.keyDown(view, { key: ']' })
        expect(await screen.findByText('Häkchen 1 von 2 ausgewählt')).toBeInTheDocument()

        fireEvent.keyDown(view, { key: 'ArrowRight', shiftKey: true })
        expect((useDoc.getState().document.overlays.p1[0] as { x: number }).x).toBeCloseTo(0.15)

        fireEvent.keyDown(view, { key: 'Delete' })
        expect(useDoc.getState().document.overlays.p1).toEqual([note])
        expect(useDoc.getState().history.undo.length).toBeGreaterThan(0)

        fireEvent.keyDown(view, { key: 'PageDown' })
        expect(useDoc.getState().viewer.activePage).toBe(1)
    })

    it('edits a text box via Enter and commits the new text', async () => {
        const view = setup([note])
        await screen.findByRole('img', { name: 'Seite 1 von 2' })
        fireEvent.keyDown(view, { key: ']' })
        fireEvent.keyDown(view, { key: 'Enter' })

        const editor = await screen.findByRole('textbox', { name: 'Text bearbeiten' })
        fireEvent.change(editor, { target: { value: 'Neue Notiz' } })
        fireEvent.blur(editor)
        await waitFor(() => expect((useDoc.getState().document.overlays.p1[0] as { text: string }).text).toBe('Neue Notiz'))
    })

    it('removes a text box that was left empty', async () => {
        const view = setup([note])
        await screen.findByRole('img', { name: 'Seite 1 von 2' })
        fireEvent.keyDown(view, { key: ']' })
        fireEvent.keyDown(view, { key: 'Enter' })
        const editor = await screen.findByRole('textbox', { name: 'Text bearbeiten' })
        fireEvent.change(editor, { target: { value: '   ' } })
        fireEvent.keyDown(view, { key: 'Escape' })
        await waitFor(() => expect(useDoc.getState().document.overlays.p1).toEqual([]))
    })

    it('shows a selectable text layer in text-select mode', async () => {
        vi.spyOn(text$, 'getPageText').mockResolvedValue({ width: 600, height: 800, items: [{ text: 'Markierbar', x: 10, y: 10, width: 50, height: 10 }], text: 'Markierbar', spans: [] })
        setup([])
        act(() => useDoc.getState().actions.setTool('text-select'))
        expect(await screen.findByText('Markierbar')).toBeInTheDocument()
    })

    it('shows render failures inside the page instead of a broken canvas', async () => {
        vi.spyOn(render$, 'renderPage').mockRejectedValue(new PdfError('invalid-pdf'))
        act(() => useDoc.getState().actions.restoreSession({ pages: [{ id: 'p1', kind: 'blank', format: 'A4' }], overlays: {}, sources: [], activePage: 0 }))
        render(<PdfViewer />)
        expect(await screen.findByRole('alert')).toHaveTextContent('kein gültiges PDF')
    })

    it('zooms with ctrl + mouse wheel', async () => {
        const view = setup()
        await screen.findByRole('img', { name: 'Seite 1 von 2' })
        act(() => useDoc.getState().actions.setZoom(1))
        fireEvent.wheel(view, { deltaY: -100, ctrlKey: true })
        expect(useDoc.getState().viewer.zoom).toBeCloseTo(1.08)
    })

    it('pans the view with the hand tool', async () => {
        const view = setup([])
        const scrollTo = vi.spyOn(view, 'scrollTo')
        act(() => useDoc.getState().actions.setTool('pan'))
        const canvas = await screen.findByRole('img', { name: 'Seite 1 von 2' })
        fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 })
        fireEvent.pointerMove(canvas, { clientX: 60, clientY: 40, pointerId: 1 })
        expect(scrollTo).toHaveBeenLastCalledWith({ left: 40, top: 60 })
        fireEvent.pointerUp(canvas, { pointerId: 1 })
    })

    it('pinch-zooms with two touch pointers', async () => {
        setup([])
        act(() => useDoc.getState().actions.setZoom(1))
        const canvas = await screen.findByRole('img', { name: 'Seite 1 von 2' })
        fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' })
        fireEvent.pointerDown(canvas, { clientX: 200, clientY: 100, pointerId: 2, pointerType: 'touch' })
        fireEvent.pointerMove(canvas, { clientX: 300, clientY: 100, pointerId: 2, pointerType: 'touch' })
        expect(useDoc.getState().viewer.zoom).toBeCloseTo(2)
        fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: 'touch' })
        fireEvent.pointerCancel(canvas, { pointerId: 1, pointerType: 'touch' })
    })
})
