import { useCallback, useState } from 'react'
import { useDoc, useDocActions } from '../../store'
import { describeError, useT } from '../../i18n'
import { isPdfError, openPdfSource, releasePdfSource } from '../../services/pdf'

export type LoadMode = 'open' | 'append'

export type PasswordPrompt = {
    file: File
    mode: LoadMode
    reason: 'missing' | 'incorrect'
}

/** Files above this size get a heads-up; they still load. */
export const LARGE_FILE_BYTES = 200 * 1024 * 1024

export const isPdfFile = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

/**
 * Opening and appending PDFs, including the password round-trip.
 * When a new document replaces the current one, the old sources are released
 * (pdf.js document destroyed, text cache cleared, bytes dropped).
 */
export function useDocumentLoader() {
    const t = useT()
    const actions = useDocActions()
    const [isLoading, setIsLoading] = useState(false)
    const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt | null>(null)

    const load = useCallback(
        async (file: File, mode: LoadMode, password?: string) => {
            if (!isPdfFile(file)) {
                actions.setError(t.toolbar.notAPdf)
                return
            }
            if (file.size > LARGE_FILE_BYTES) actions.setNotice(t.toolbar.largeFile(Math.round(file.size / (1024 * 1024))))

            setIsLoading(true)
            try {
                const bytes = new Uint8Array(await file.arrayBuffer())
                const source = await openPdfSource(bytes, file.name, { password })
                if (mode === 'open') {
                    const previous = Object.keys(useDoc.getState().document.sources)
                    actions.openDocument(source)
                    await Promise.all(previous.map(releasePdfSource))
                } else {
                    actions.appendSource(source)
                }
                setPasswordPrompt(null)
                actions.setError(undefined)
                if (source.encrypted) actions.setNotice(t.toolbar.encryptedNotice)
            } catch (error) {
                if (isPdfError(error, 'password-required') || isPdfError(error, 'password-incorrect')) {
                    setPasswordPrompt({ file, mode, reason: error.code === 'password-incorrect' ? 'incorrect' : 'missing' })
                } else {
                    actions.setError(describeError(error, t))
                }
            } finally {
                setIsLoading(false)
            }
        },
        [actions, t]
    )

    const submitPassword = useCallback(
        (password: string) => {
            if (passwordPrompt) void load(passwordPrompt.file, passwordPrompt.mode, password)
        },
        [load, passwordPrompt]
    )

    const cancelPassword = useCallback(() => setPasswordPrompt(null), [])

    return { load, isLoading, passwordPrompt, submitPassword, cancelPassword }
}
