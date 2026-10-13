import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFitZoom } from './useFitZoom'

describe('useFitZoom hook', () => {
    it('calculates fit-to-width zoom ratio', () => {
        const setZoomForFit = vi.fn()
        const pageSize = { width: 500, height: 800 }
        const stageSize = { width: 1000, height: 900 }

        renderHook(() => useFitZoom('width', pageSize, stageSize, 1.0, setZoomForFit))
        expect(setZoomForFit).toHaveBeenCalledWith(expect.any(Number))
    })

    it('calculates fit-to-page zoom ratio', () => {
        const setZoomForFit = vi.fn()
        const pageSize = { width: 500, height: 800 }
        const stageSize = { width: 1000, height: 900 }

        renderHook(() => useFitZoom('page', pageSize, stageSize, 1.0, setZoomForFit))
        expect(setZoomForFit).toHaveBeenCalledWith(expect.any(Number))
    })

    it('does nothing when fitMode is manual or sizes are invalid', () => {
        const setZoomForFit = vi.fn()
        renderHook(() => useFitZoom('manual', null, { width: 1000, height: 900 }, 1.0, setZoomForFit))
        expect(setZoomForFit).not.toHaveBeenCalled()
    })
})
