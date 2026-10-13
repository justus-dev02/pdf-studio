import { useState } from 'react'
import type { RefObject } from 'react'

type Point = { x: number; y: number }

type UsePdfPanInteractionsArgs = {
    wrapperRef: RefObject<HTMLDivElement>
}

export function usePdfPanInteractions({ wrapperRef }: UsePdfPanInteractionsArgs) {
    const [scrollStart, setScrollStart] = useState<{ l: number; t: number } | null>(null)

    const beginPan = () => {
        const wrap = wrapperRef.current
        if (!wrap) return
        setScrollStart({ l: wrap.scrollLeft, t: wrap.scrollTop })
    }

    const updatePan = (startPx: Point, point: Point) => {
        const wrap = wrapperRef.current
        if (!wrap || !scrollStart) return
        const dx = startPx.x - point.x
        const dy = startPx.y - point.y
        wrap.scrollTo({ left: scrollStart.l + dx, top: scrollStart.t + dy })
    }

    const resetPan = () => setScrollStart(null)

    return {
        beginPan,
        updatePan,
        resetPan,
    }
}
