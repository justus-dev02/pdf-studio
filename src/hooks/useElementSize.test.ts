import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useElementSize } from './useElementSize'

describe('useElementSize hook', () => {
    it('returns initial 0 size for unattached ref', () => {
        const ref = { current: null }
        const { result } = renderHook(() => useElementSize(ref))
        expect(result.current).toEqual({ width: 0, height: 0 })
    })

    it('measures element size when attached', () => {
        const el = document.createElement('div')
        Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
        Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
        const ref = { current: el }

        let callback: () => void = () => {}
        const disconnect = vi.fn()

        window.ResizeObserver = vi.fn().mockImplementation((cb) => {
            callback = cb
            return { observe: vi.fn(), disconnect, unobserve: vi.fn() }
        })

        const { result, unmount } = renderHook(() => useElementSize(ref))
        expect(result.current).toEqual({ width: 800, height: 600 })

        act(() => {
            Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true })
            Object.defineProperty(el, 'clientHeight', { value: 750, configurable: true })
            callback()
        })
        expect(result.current).toEqual({ width: 1000, height: 750 })

        unmount()
        expect(disconnect).toHaveBeenCalled()
    })
})
