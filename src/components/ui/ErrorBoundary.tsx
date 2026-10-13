import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { getMessages } from '../../i18n'
import { useDoc } from '../../store/docStore'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
    override state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        // Single place where render errors surface; a crash reporter would hook in here.
        console.error('Unhandled render error', error, info.componentStack)
    }

    override render() {
        if (!this.state.error) return this.props.children
        const t = getMessages(useDoc.getState().ui.locale)
        return (
            <div role="alert" className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
                <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                        <AlertTriangle className="h-6 w-6" aria-hidden />
                    </div>
                    <h1 className="text-xl font-bold">{t.errors.boundaryTitle}</h1>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">{this.state.error.message}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-black"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden />
                        {t.errors.boundaryReload}
                    </button>
                </div>
            </div>
        )
    }
}
