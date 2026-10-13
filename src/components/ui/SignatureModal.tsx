import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Check, Eraser } from 'lucide-react'
import Modal from './Modal'
import { Button } from './Button'
import { useDocActions } from '../../store'
import { useT } from '../../i18n'

type SignatureModalProps = { onClose: () => void }

const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 240

export default function SignatureModal({ onClose }: SignatureModalProps) {
    const t = useT()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const [isEmpty, setIsEmpty] = useState(true)
    const { setStampImage, setTool } = useDocActions()

    const toCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
        const canvas = event.currentTarget
        const rect = canvas.getBoundingClientRect()
        return {
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        }
    }

    // Pointer events cover mouse, pen and touch with a single code path.
    const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        const ctx = event.currentTarget.getContext('2d')
        if (!ctx) return
        event.currentTarget.setPointerCapture?.(event.pointerId)
        const { x, y } = toCanvasPoint(event)
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#000000'
        ctx.beginPath()
        ctx.moveTo(x, y)
        drawing.current = true
    }

    const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return
        const ctx = event.currentTarget.getContext('2d')
        if (!ctx) return
        const { x, y } = toCanvasPoint(event)
        ctx.lineTo(x, y)
        ctx.stroke()
        setIsEmpty(false)
    }

    const stop = () => {
        drawing.current = false
    }

    const clear = () => {
        const canvas = canvasRef.current
        canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
        setIsEmpty(true)
    }

    const accept = () => {
        const canvas = canvasRef.current
        if (!canvas || isEmpty) return
        setStampImage(canvas.toDataURL('image/png'))
        setTool('stamp')
        onClose()
    }

    return (
        <Modal
            title={t.signature.title}
            description={t.signature.hint}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={clear} className="mr-auto">
                        <Eraser className="h-4 w-4" aria-hidden />
                        {t.signature.clear}
                    </Button>
                    <Button onClick={onClose}>{t.common.cancel}</Button>
                    <Button variant="primary" onClick={accept} disabled={isEmpty}>
                        <Check className="h-4 w-4" aria-hidden />
                        {t.common.confirm}
                    </Button>
                </>
            }
        >
            <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    aria-label={t.signature.canvasLabel}
                    className="h-44 w-full cursor-crosshair touch-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={stop}
                    onPointerLeave={stop}
                    onPointerCancel={stop}
                />
            </div>
        </Modal>
    )
}
