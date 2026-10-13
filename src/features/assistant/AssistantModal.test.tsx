import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssistantModal from './AssistantModal'
import { useDoc } from '../../store'
import { openPdfSource } from '../../services/pdf'
import { readFixture } from '../../test/pdfFixtures'
import { createWebEngine, setAnalysisEngine } from '../../services/analysis/engine'

async function loadSample() {
    const source = await openPdfSource(readFixture('sample.pdf'), 'sample.pdf')
    act(() => useDoc.getState().actions.openDocument(source))
}

const respond = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

beforeEach(() => setAnalysisEngine(createWebEngine(null)))

describe('AssistantModal', () => {
    it('explains that a document is needed', () => {
        render(<AssistantModal onClose={vi.fn()} />)
        expect(screen.getByRole('dialog', { name: 'Analyse & KI' })).toBeInTheDocument()
        expect(screen.getByText('Bitte zuerst ein PDF öffnen.')).toBeInTheDocument()
    })

    it('implements the ARIA tabs pattern with arrow-key navigation', async () => {
        render(<AssistantModal onClose={vi.fn()} />)
        const tabs = screen.getAllByRole('tab')
        expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
        fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
        expect(screen.getByRole('tab', { name: 'Zusammenfassung' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByRole('tab', { name: 'Zusammenfassung' })).toHaveFocus()
        fireEvent.keyDown(tabs[1], { key: 'End' })
        expect(screen.getByRole('tabpanel')).toHaveAccessibleName('KI-Anbieter')
        fireEvent.keyDown(tabs[4], { key: 'ArrowRight' })
        expect(screen.getByRole('tab', { name: 'Textanalyse' })).toHaveAttribute('aria-selected', 'true')
    })

    it('shows real text statistics and file analysis', async () => {
        await loadSample()
        render(<AssistantModal onClose={vi.fn()} />)

        expect(await screen.findByText('Deutsch')).toBeInTheDocument()
        expect(screen.getByText('Erkannte Aufgaben & Fristen')).toBeInTheDocument()
        expect(screen.getAllByText(/Frist/).length).toBeGreaterThan(0)

        fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }))
        expect(await screen.findByText('sample.pdf')).toBeInTheDocument()
        // A real SHA-256 digest (64 hex characters), not a placeholder.
        expect(screen.getByText(/^[0-9a-f]{64}$/)).toBeInTheDocument()
    })

    it('converts to Markdown and counts tokens with a real tokenizer', async () => {
        await loadSample()
        render(<AssistantModal onClose={vi.fn()} />)
        fireEvent.click(screen.getByRole('tab', { name: 'Markdown' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Konvertieren' }))

        const preview = (await screen.findByLabelText('Markdown-Vorschau', {}, { timeout: 5000 })) as HTMLTextAreaElement
        expect(preview.value).toContain('Rechnung Nr. 2026-001')
        expect(preview.value).not.toContain('Muster GmbH')
        expect(screen.getByText(/o200k_base/)).toBeInTheDocument()
        expect(screen.getByText(/wiederkehrende Kopf-\/Fußzeilen entfernt/)).toBeInTheDocument()
    })

    it('answers questions with BM25 passages without any AI provider', async () => {
        const user = userEvent.setup()
        await loadSample()
        render(<AssistantModal onClose={vi.fn()} />)
        await user.click(screen.getByRole('tab', { name: 'Fragen ans Dokument' }))
        await user.type(await screen.findByLabelText('Frage zum Dokument …'), 'Kündigung Frist{Enter}')

        const answer = await screen.findByText(/Vertrag kann mit einer Frist/)
        expect(answer.closest('li')).toHaveTextContent('S. 3')
    })

    it('uses the configured provider for summaries and keeps the key out of localStorage', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            respond({ choices: [{ message: { content: '{"summary":"Eine Rechnung mit Zahlungsfrist.","action_items":[{"text":"Betrag zahlen","page":1}]}' } }] })
        )
        await loadSample()
        render(<AssistantModal onClose={vi.fn()} />)

        await user.click(screen.getByRole('tab', { name: 'KI-Anbieter' }))
        await user.type(screen.getByLabelText('Modell'), 'qwen2.5')
        await user.type(screen.getByLabelText(/API-Schlüssel/), 'local-key')
        await user.click(screen.getByRole('button', { name: 'Speichern' }))
        expect(JSON.stringify({ ...localStorage })).not.toContain('local-key')

        await user.click(screen.getByRole('tab', { name: 'Zusammenfassung' }))
        expect(await screen.findByText('Der Dokumenttext wird an localhost:1234 gesendet.')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Mit KI zusammenfassen' }))

        expect(await screen.findByText('Eine Rechnung mit Zahlungsfrist.')).toBeInTheDocument()
        expect(screen.getByText('Betrag zahlen')).toBeInTheDocument()
        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
        expect(String(url)).toBe('http://localhost:1234/v1/chat/completions')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer local-key')
    })

    it('shows provider errors instead of fake results', async () => {
        const user = userEvent.setup()
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
        localStorage.setItem('pdf-studio.llm-settings', JSON.stringify({ provider: 'openai-compatible', endpoint: 'http://localhost:1234/v1', model: 'm' }))
        await loadSample()
        render(<AssistantModal onClose={vi.fn()} />)
        await user.click(screen.getByRole('tab', { name: 'Zusammenfassung' }))
        await user.click(await screen.findByRole('button', { name: 'Mit KI zusammenfassen' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Keine Verbindung zum KI-Anbieter')
    })

    it('loads the model list from the provider', async () => {
        const user = userEvent.setup()
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond({ data: [{ id: 'llama3' }, { id: 'qwen2.5' }] }))
        render(<AssistantModal onClose={vi.fn()} />)
        await user.click(screen.getByRole('tab', { name: 'KI-Anbieter' }))
        await user.click(screen.getByRole('button', { name: 'Modelle laden' }))
        await waitFor(() => expect(screen.getByText('2 Modelle gefunden.')).toBeInTheDocument())

        await user.selectOptions(screen.getByLabelText('Anbieter'), 'gemini')
        expect(screen.getByLabelText('Modell')).toHaveValue('gemini-2.5-flash')
        expect(within(screen.getByRole('tabpanel')).queryByText(/LM Studio:/)).not.toBeInTheDocument()
    })
})
