import { createContext, useContext } from 'react'
import type { LoadMode } from './useDocumentLoader'

/**
 * Document-level commands shared by the toolbar, the drop zone and keyboard shortcuts.
 * Provided once by the app shell so loading state and the password dialog exist only once.
 */
export type DocumentCommands = {
    load: (file: File, mode: LoadMode) => Promise<void>
    isLoading: boolean
    exportDocument: () => Promise<void>
    isExporting: boolean
}

export const DocumentCommandsContext = createContext<DocumentCommands | null>(null)

export function useDocumentCommands(): DocumentCommands {
    const commands = useContext(DocumentCommandsContext)
    if (!commands) throw new Error('useDocumentCommands must be used inside <DocumentCommandsContext.Provider>')
    return commands
}
