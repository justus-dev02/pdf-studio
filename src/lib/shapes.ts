import { clamp } from './geometry'
import type { Shape } from '../types'

export type BBox = { x: number; y: number; w: number; h: number }

export const clamp01 = (v: number) => clamp(v, 0, 1)

export const getBBox = (s: Shape): BBox => {
    switch (s.type) {
        case 'highlight':
            return { x: s.x, y: s.y, w: s.w, h: s.h }
        case 'text':
            return { x: s.x, y: s.y, w: s.w, h: s.h }
        case 'checkbox':
            return { x: s.x, y: s.y, w: s.size, h: s.size }
        case 'stamp':
            return { x: s.x, y: s.y, w: s.w, h: s.h }
        case 'pen': {
            if (s.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
            const xs = s.points.map((p) => p.x)
            const ys = s.points.map((p) => p.y)
            const minx = Math.min(...xs)
            const miny = Math.min(...ys)
            const maxx = Math.max(...xs)
            const maxy = Math.max(...ys)
            const pad = 0.005
            return {
                x: clamp01(minx - pad),
                y: clamp01(miny - pad),
                w: clamp01(maxx - minx + pad * 2),
                h: clamp01(maxy - miny + pad * 2),
            }
        }
    }
}

export const hitTestIndex = (shapes: Shape[], nx: number, ny: number): number | null => {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const bb = getBBox(shapes[i])
        if (nx >= bb.x && nx <= bb.x + bb.w && ny >= bb.y && ny <= bb.y + bb.h) return i
    }
    return null
}

export const translateShape = (shape: Shape, dx: number, dy: number): Shape => {
    switch (shape.type) {
        case 'highlight':
            return { ...shape, x: clamp01(shape.x + dx), y: clamp01(shape.y + dy) }
        case 'text':
            return { ...shape, x: clamp01(shape.x + dx), y: clamp01(shape.y + dy) }
        case 'checkbox':
            return { ...shape, x: clamp01(shape.x + dx), y: clamp01(shape.y + dy) }
        case 'stamp':
            return { ...shape, x: clamp01(shape.x + dx), y: clamp01(shape.y + dy) }
        case 'pen':
            return {
                ...shape,
                points: shape.points.map((p) => ({
                    x: clamp01(p.x + dx),
                    y: clamp01(p.y + dy),
                })),
            }
    }
}

export const resizeShape = (shape: Shape, from: BBox, to: BBox): Shape => {
    const safeFromW = from.w || 0.0001
    const safeFromH = from.h || 0.0001
    const scaleX = to.w / safeFromW
    const scaleY = to.h / safeFromH

    switch (shape.type) {
        case 'highlight':
        case 'text':
        case 'stamp':
            return {
                ...shape,
                x: clamp01(to.x),
                y: clamp01(to.y),
                w: clamp01(to.w),
                h: clamp01(to.h),
            }
        case 'checkbox': {
            const size = clamp01(Math.min(to.w, to.h))
            return {
                ...shape,
                x: clamp01(to.x),
                y: clamp01(to.y),
                size,
            }
        }
        case 'pen': {
            const nextPoints = shape.points.map((p) => ({
                x: clamp01(to.x + (p.x - from.x) * scaleX),
                y: clamp01(to.y + (p.y - from.y) * scaleY),
            }))
            const scaleAvg = (scaleX + scaleY) / 2
            return {
                ...shape,
                points: nextPoints,
                width: Math.max(0.001, shape.width * scaleAvg),
            }
        }
    }
}
