import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from './Sidebar'
import { useDoc } from '../../store'
import * as render$ from '../../services/pdf/render'
import { PdfError } from '../../services/pdf'

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 })
})

const pages = () => useDoc.getState().document.pages.map((p) => p.id)

function setup() {
    act(() =>
        useDoc.getState().actions.restoreSession({
            pages: ['a', 'b', 'c'].map((id) => ({ id, kind: 'blank' as const, format: 'A4' as const })),
            overlays: {},
            sources: [],
            activePage: 0,
        })
    )
    render(<Sidebar />)
    return screen.getByRole('navigation', { name: 'Seitenübersicht' })
}

describe('Sidebar', () => {
    it('lists pages with accessible reorder and delete buttons', async () => {
        vi.spyOn(render$, 'renderPage').mockResolvedValue({ width: 1, height: 1 })
        const user = userEvent.setup()
        const nav = setup()
        expect(within(nav).getAllByRole('listitem')).toHaveLength(3)
        expect(within(nav).getByRole('button', { name: 'Seite 1 nach oben verschieben' })).toBeDisabled()

        await user.click(within(nav).getByRole('button', { name: 'Seite 1 nach unten verschieben' }))
        expect(pages()).toEqual(['b', 'a', 'c'])
        await user.click(within(nav).getByRole('button', { name: 'Seite 3 nach oben verschieben' }))
        expect(pages()).toEqual(['b', 'c', 'a'])
        await user.click(within(nav).getByRole('button', { name: 'Seite 1 löschen' }))
        expect(pages()).toEqual(['c', 'a'])
        await user.click(within(nav).getByRole('button', { name: 'Leere A4-Seite anhängen' }))
        expect(pages()).toHaveLength(3)
    })

    it('shows a placeholder when a thumbnail cannot be rendered', async () => {
        vi.spyOn(render$, 'renderPage').mockRejectedValue(new PdfError('invalid-pdf'))
        setup()
        expect(await screen.findAllByText('Vorschau nicht verfügbar')).toHaveLength(3)
    })
})
