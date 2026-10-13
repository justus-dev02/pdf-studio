import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'
import { useDoc } from '../../store'

function ProblemChild(): JSX.Element {
    throw new Error('Test failure inside component')
}

describe('ErrorBoundary', () => {
    it('renders a localized fallback with the error message', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        useDoc.getState().actions.setLocale('en')
        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        )
        expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred')
        expect(screen.getByText(/Test failure inside component/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Reload application' })).toBeInTheDocument()
        useDoc.getState().actions.setLocale('de')
    })
})
