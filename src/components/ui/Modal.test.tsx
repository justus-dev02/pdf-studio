import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'
import Toasts from './Toasts'
import { useDoc } from '../../store'

describe('Modal', () => {
    it('is an accessible, labelled dialog that receives focus', () => {
        render(
            <Modal title="Titel" description="Beschreibung" onClose={vi.fn()}>
                <button type="button">Erster</button>
            </Modal>
        )
        const dialog = screen.getByRole('dialog', { name: 'Titel' })
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAccessibleDescription('Beschreibung')
        // The close button is the first focusable element.
        expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
    })

    it('traps Tab inside the dialog', async () => {
        const user = userEvent.setup()
        render(
            <Modal title="Titel" onClose={vi.fn()}>
                <button type="button">A</button>
                <button type="button">B</button>
            </Modal>
        )
        const close = screen.getByRole('button', { name: 'Schließen' })
        await user.tab()
        await user.tab()
        expect(screen.getByRole('button', { name: 'B' })).toHaveFocus()
        await user.tab()
        expect(close).toHaveFocus()
        await user.tab({ shift: true })
        expect(screen.getByRole('button', { name: 'B' })).toHaveFocus()
    })

    it('closes with Escape, the close button or a backdrop click and restores focus', () => {
        const opener = document.createElement('button')
        document.body.appendChild(opener)
        opener.focus()
        const onClose = vi.fn()
        const { unmount } = render(
            <Modal title="Titel" onClose={onClose}>
                <p>Inhalt</p>
            </Modal>
        )
        fireEvent.keyDown(document, { key: 'Escape' })
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
        fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
        expect(onClose).toHaveBeenCalledTimes(3)
        unmount()
        expect(opener).toHaveFocus()
    })
})

describe('Toasts', () => {
    it('shows errors as alerts and notices as status messages', () => {
        useDoc.getState().actions.setError('Kaputt')
        useDoc.getState().actions.setNotice('Gespeichert')
        render(<Toasts />)
        expect(screen.getByRole('alert')).toHaveTextContent('Kaputt')
        expect(screen.getByRole('status')).toHaveTextContent('Gespeichert')
        fireEvent.click(screen.getAllByRole('button', { name: 'Meldung schließen' })[1])
        expect(useDoc.getState().ui.error).toBeUndefined()
    })
})
