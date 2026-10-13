import type { Shape } from '../../../types'
import { getBBox } from '../../../lib/shapes'

export type SelectionOverlayProps = {
    shape: Shape
}

const HANDLE_SIZE = 0.015

export default function SelectionOverlay({ shape }: SelectionOverlayProps) {
    const bb = getBBox(shape)
    const handles = [
        { x: bb.x, y: bb.y },
        { x: bb.x + bb.w, y: bb.y },
        { x: bb.x, y: bb.y + bb.h },
        { x: bb.x + bb.w, y: bb.y + bb.h },
    ]

    return (
        // An <svg> is a replaced element: `inset-0` alone leaves it at the default 300×150 px,
        // which shrank the selection box. Width and height must be set explicitly.
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <rect
                x={`${bb.x * 100}%`}
                y={`${bb.y * 100}%`}
                width={`${bb.w * 100}%`}
                height={`${bb.h * 100}%`}
                fill="none"
                stroke="dodgerblue"
                strokeDasharray="6 3"
                strokeWidth={2}
            />
            {handles.map((handle, idx) => (
                <rect
                    key={idx}
                    x={`${(handle.x - HANDLE_SIZE / 2) * 100}%`}
                    y={`${(handle.y - HANDLE_SIZE / 2) * 100}%`}
                    width={`${HANDLE_SIZE * 100}%`}
                    height={`${HANDLE_SIZE * 100}%`}
                    fill="white"
                    stroke="dodgerblue"
                    strokeWidth={1}
                />
            ))}
        </svg>
    )
}
