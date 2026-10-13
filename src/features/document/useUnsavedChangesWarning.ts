import { useEffect } from 'react'
import { useDoc } from '../../store'

/** Asks before closing the tab while there are changes that were not exported. */
export function useUnsavedChangesWarning(message: string) {
    const dirty = useDoc((s) => s.document.dirty)

    useEffect(() => {
        if (!dirty) return
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            // Required by older browsers; modern ones show their own generic text.
            event.returnValue = message
            return message
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [dirty, message])
}
