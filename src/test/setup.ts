import '@testing-library/jest-dom/vitest'

class MockResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
    window.ResizeObserver = MockResizeObserver
}

// jsdom has no PointerEvent; without it fireEvent.pointer* drops clientX/pointerId/pointerType.
if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
        readonly pointerId: number
        readonly pointerType: string
        constructor(type: string, init: PointerEventInit = {}) {
            super(type, init)
            this.pointerId = init.pointerId ?? 1
            this.pointerType = init.pointerType ?? 'mouse'
        }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}

// jsdom does not implement scrolling.
Element.prototype.scrollTo ??= function scrollTo() {}

// jsdom implements Blob/File without arrayBuffer(); every supported browser has it.
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as ArrayBuffer)
            reader.onerror = () => reject(reader.error)
            reader.readAsArrayBuffer(this)
        })
    }
}

// pdf.js runs its "fake worker" in Node: point it at the worker module on disk.
const { GlobalWorkerOptions } = await import('pdfjs-dist')
const { pathToFileURL } = await import('node:url')
const { resolve } = await import('node:path')
GlobalWorkerOptions.workerSrc = pathToFileURL(resolve(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')).href

// jsdom has no canvas backend and logs "Not implemented" for every getContext call.
// Tests that need a context stub it explicitly (see services/pdf/render.test.ts).
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

// Every test starts from a fresh store and empty web storage.
const { afterEach } = await import('vitest')
const { cleanup } = await import('@testing-library/react')
const { useDoc } = await import('../store/docStore')
afterEach(() => {
    cleanup()
    const { actions, ui } = useDoc.getState()
    actions.reset()
    if (ui.locale !== 'de') actions.setLocale('de')
    if (useDoc.getState().ui.dark) actions.toggleDark()
    localStorage.clear()
    sessionStorage.clear()
})
