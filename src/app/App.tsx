import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import Toolbar from '../features/toolbar/Toolbar'
import Sidebar from '../features/sidebar/Sidebar'
import PdfViewer from '../features/pdf/PdfViewer'
import Toasts from '../components/ui/Toasts'
import PasswordDialog from '../features/document/PasswordDialog'
import RestoreBanner from '../features/document/RestoreBanner'
import { DocumentCommandsContext } from '../features/document/DocumentCommands'
import type { DocumentCommands } from '../features/document/DocumentCommands'
import { useDocumentLoader, isPdfFile } from '../features/document/useDocumentLoader'
import { useExport } from '../features/document/useExport'
import { useAutosave } from '../features/document/useAutosave'
import { useUnsavedChangesWarning } from '../features/document/useUnsavedChangesWarning'
import { useDoc, useDocActions } from '../store'
import { useT } from '../i18n'
import '../styles.css'

export default function App() {
    const t = useT()
    const dark = useDoc((s) => s.ui.dark)
    const locale = useDoc((s) => s.ui.locale)
    const sidebarOpen = useDoc((s) => s.ui.sidebarOpen)
    const hasPages = useDoc((s) => s.document.pages.length > 0)
    const { toggleSidebar } = useDocActions()

    const loader = useDocumentLoader()
    const { exportDocument, isExporting } = useExport()
    const autosave = useAutosave()
    const [dragging, setDragging] = useState(false)

    useUnsavedChangesWarning(t.app.unsavedChanges)

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark)
    }, [dark])

    useEffect(() => {
        document.documentElement.lang = locale
    }, [locale])

    const commands = useMemo<DocumentCommands>(
        () => ({ load: loader.load, isLoading: loader.isLoading, exportDocument, isExporting }),
        [loader.load, loader.isLoading, exportDocument, isExporting]
    )

    const onDrop = (event: DragEvent) => {
        event.preventDefault()
        setDragging(false)
        const files = [...event.dataTransfer.files].filter(isPdfFile)
        if (files.length === 0) return
        // The first file replaces an empty editor; everything else is appended.
        void (async () => {
            for (const [i, file] of files.entries()) await loader.load(file, i === 0 && !useDoc.getState().document.pages.length ? 'open' : 'append')
        })()
    }

    return (
        <DocumentCommandsContext.Provider value={commands}>
            <div
                className="flex h-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
                onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes('Files')) return
                    event.preventDefault()
                    setDragging(true)
                }}
                onDragLeave={(event) => {
                    if (event.currentTarget === event.target) setDragging(false)
                }}
                onDrop={onDrop}
            >
                <a href="#document-view" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">
                    {t.app.skipToDocument}
                </a>
                <Toolbar />
                {autosave.candidate && !hasPages && (
                    <RestoreBanner candidate={autosave.candidate} onRestore={() => void autosave.restore()} onDiscard={() => void autosave.discard()} />
                )}
                <main className="flex min-h-0 flex-1">
                    {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={toggleSidebar} aria-hidden />}
                    <Sidebar />
                    <PdfViewer />
                </main>
                {dragging && (
                    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-indigo-600/15 ring-4 ring-inset ring-indigo-500" aria-hidden>
                        <span className="rounded-xl bg-white px-4 py-2 text-sm font-medium shadow dark:bg-neutral-900">{t.app.dropHint}</span>
                    </div>
                )}
                <Toasts />
                {loader.passwordPrompt && (
                    <PasswordDialog
                        key={`${loader.passwordPrompt.file.name}-${loader.passwordPrompt.reason}`}
                        reason={loader.passwordPrompt.reason}
                        onSubmit={loader.submitPassword}
                        onCancel={loader.cancelPassword}
                    />
                )}
            </div>
        </DocumentCommandsContext.Provider>
    )
}
