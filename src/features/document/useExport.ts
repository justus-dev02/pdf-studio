import { useCallback, useState } from 'react'
import { useDoc, useDocActions } from '../../store'
import { describeError, useT } from '../../i18n'
import { downloadBlob, withSuffix } from '../../lib/download'

export function useExport() {
    const t = useT()
    const actions = useDocActions()
    const [isExporting, setIsExporting] = useState(false)

    const exportDocument = useCallback(async () => {
        // Read at call time instead of subscribing: the toolbar must not re-render on every overlay change.
        const { pages, overlays, sources } = useDoc.getState().document
        if (pages.length === 0 || isExporting) return
        setIsExporting(true)
        try {
            // pdf-lib is only needed here; keep it out of the initial bundle.
            const { exportPdf } = await import('../../services/pdf/export')
            const bytes = await exportPdf(pages, overlays)
            const firstSource = Object.values(sources)[0]
            downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), withSuffix(firstSource?.name ?? 'document.pdf', '-edited', 'pdf'))
            actions.markSaved()
            actions.setNotice(t.toolbar.exported)
        } catch (error) {
            actions.setError(describeError(error, t))
        } finally {
            setIsExporting(false)
        }
    }, [actions, isExporting, t])

    return { exportDocument, isExporting }
}
