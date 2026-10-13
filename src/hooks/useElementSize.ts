import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export type ElementSize = { width: number; height: number }

export function useElementSize<T extends Element>(ref: RefObject<T>): ElementSize {
    const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
        update()
        const observer = new ResizeObserver(update)
        observer.observe(el)
        return () => observer.disconnect()
    }, [ref])

    return size
}
