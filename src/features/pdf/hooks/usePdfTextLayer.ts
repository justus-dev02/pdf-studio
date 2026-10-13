import { useEffect, useState } from 'react'
import { getPageText, isCancelled } from '../../../services/pdf'
import type { PdfTextItem } from '../../../services/pdf'
import type { PageRef } from '../../../types'

type UsePdfTextLayerArgs = {
    page?: PageRef
    enabled: boolean
    onError?: (error: unknown) => void
}

const EMPTY: PdfTextItem[] = []

/** Text items (PDF points, scale 1) of the page; loaded from the shared text cache only when the layer is enabled. */
export function usePdfTextLayer({ page, enabled, onError }: UsePdfTextLayerArgs): PdfTextItem[] {
    const [loaded, setLoaded] = useState<{ pageId: string; items: PdfTextItem[] } | null>(null)

    useEffect(() => {
        if (!enabled || !page) return
        let active = true
        getPageText(page)
            .then((text) => {
                if (active) setLoaded({ pageId: page.id, items: text.items })
            })
            .catch((error: unknown) => {
                if (!active || isCancelled(error)) return
                setLoaded({ pageId: page.id, items: EMPTY })
                onError?.(error)
            })
        return () => {
            active = false
        }
    }, [enabled, page, onError])

    return enabled && page && loaded?.pageId === page.id ? loaded.items : EMPTY
}
