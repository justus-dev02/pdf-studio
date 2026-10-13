import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { distance } from '../../../lib/geometry'
import type { InteractionMode } from './interactionTypes'

type UsePdfPinchZoomArgs = {
    zoom: number
    setZoom: (z: number) => void
    setMode: (mode: InteractionMode) => void
}

export function usePdfPinchZoom({ zoom, setZoom, setMode }: UsePdfPinchZoomArgs) {
    const pointerMap = useRef<Map<number, { x: number; y: number }>>(new Map())
    const pinchState = useRef<{ startDistance: number; startZoom: number } | null>(null)

    const onPointerDown = (e: ReactPointerEvent) => {
        if (e.pointerType !== 'touch') return false
        pointerMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointerMap.current.size === 2) {
            const [a, b] = Array.from(pointerMap.current.values())
            pinchState.current = { startDistance: distance(a, b), startZoom: zoom }
            setMode('pinching')
            e.preventDefault()
            return true
        }
        return false
    }

    const onPointerMove = (e: ReactPointerEvent) => {
        if (!pinchState.current) return false
        pointerMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const points = Array.from(pointerMap.current.values())
        if (points.length < 2) return false
        const currentDistance = distance(points[0], points[1])
        const ratio = currentDistance / pinchState.current.startDistance
        setZoom(pinchState.current.startZoom * ratio)
        e.preventDefault()
        return true
    }

    const onPointerUp = (e: ReactPointerEvent) => {
        if (e.pointerType === 'touch') {
            pointerMap.current.delete(e.pointerId)
        }
        if (pinchState.current && pointerMap.current.size < 2) {
            pinchState.current = null
            setMode('idle')
            return true
        }
        return false
    }

    const onPointerCancel = (e: ReactPointerEvent) => {
        if (e.pointerType === 'touch') {
            pointerMap.current.delete(e.pointerId)
        }
        if (pointerMap.current.size < 2) {
            pinchState.current = null
            setMode('idle')
            return true
        }
        return false
    }

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
    }
}
