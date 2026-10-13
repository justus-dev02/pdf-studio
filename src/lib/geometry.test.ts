import { describe, expect, it } from 'vitest'
import { clamp, distance } from './geometry'

describe('geometry utilities', () => {
    it('clamps values correctly within bounds', () => {
        expect(clamp(5, 0, 10)).toBe(5)
        expect(clamp(-5, 0, 10)).toBe(0)
        expect(clamp(15, 0, 10)).toBe(10)
    })

    it('calculates Euclidean distance between two 2D points', () => {
        const p1 = { x: 0, y: 0 }
        const p2 = { x: 3, y: 4 }
        expect(distance(p1, p2)).toBe(5)
    })
})
