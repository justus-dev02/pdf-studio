import { useEffect } from 'react'
import type { FitMode } from '../../../types'
import type { PageSize } from '../../../services/pdf'

export function useFitZoom(
    fitMode: FitMode,
    pageSize: PageSize | null,
    stageSize: { width: number; height: number },
    zoom: number,
    setZoomForFit: (z: number) => void
) {
    useEffect(() => {
        if (fitMode === 'manual' || !pageSize) return
        const pad = 32
        const availW = Math.max(1, stageSize.width - pad)
        const availH = Math.max(1, stageSize.height - pad)
        if (!availW || !availH) return
        const next = fitMode === 'width'
            ? (availW / pageSize.width)
            : Math.min(availW / pageSize.width, availH / pageSize.height)
        if (!Number.isFinite(next)) return
        if (Math.abs(next - zoom) < 0.01) return
        setZoomForFit(next)
    }, [fitMode, pageSize, stageSize, setZoomForFit, zoom])
}
