import type { Shape } from '../../../types'
import type { PageSize } from '../../../services/pdf'
import { fontStack } from '../../../lib/fonts'

export type PdfOverlaysProps = {
    shapes: Shape[]
    tempShape: Shape | null
    editingIndex: number | null
    zoom: number
    /** Page size in PDF points; needed to render stroke widths exactly like the export. */
    pageSize: PageSize
}

export default function PdfOverlays({ shapes, tempShape, editingIndex, zoom, pageSize }: PdfOverlaysProps) {
    // Same unit as the export: stroke width and checkbox size are relative to the shorter page side.
    const shortSidePx = Math.min(pageSize.width, pageSize.height) * zoom
    return (
        <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden>
            {shapes.map((shape, idx) => {
                if (editingIndex !== null && editingIndex === idx && shape.type === 'text') return null
                return renderShape(shape, idx, false, zoom, shortSidePx)
            })}
            {tempShape && renderShape(tempShape, -1, true, zoom, shortSidePx)}
        </svg>
    )
}

function renderShape(shape: Shape, key: number, temp: boolean, zoom: number, shortSidePx: number) {
    switch (shape.type) {
        case 'highlight':
            return (
                <rect
                    key={key}
                    x={`${shape.x * 100}%`}
                    y={`${shape.y * 100}%`}
                    width={`${shape.w * 100}%`}
                    height={`${shape.h * 100}%`}
                    fill={shape.color || '#eab308'}
                    fillOpacity={shape.opacity}
                    stroke={temp ? 'orange' : 'none'}
                    strokeDasharray={temp ? '4 2' : 'none'}
                />
            )
        case 'pen': {
            // Path data has no percentage units, so points are drawn in a normalized 0..1 viewBox;
            // `non-scaling-stroke` keeps the stroke width in screen pixels despite the stretch.
            const d = shape.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
            return (
                <svg key={key} x="0" y="0" width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" className="overflow-visible">
                    <path
                        d={d}
                        stroke={shape.color || '#000000'}
                        strokeWidth={shape.width * shortSidePx}
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        }
        case 'text':
            return (
                <foreignObject
                    key={key}
                    x={`${shape.x * 100}%`}
                    y={`${shape.y * 100}%`}
                    width={`${shape.w * 100}%`}
                    height={`${shape.h * 100}%`}
                >
                    <div
                        className="whitespace-pre-wrap"
                        style={{
                            padding: `0 ${2 * zoom}px`,
                            fontSize: `${shape.fontSize * zoom}px`,
                            lineHeight: 1.2,
                            fontFamily: fontStack(shape.fontFamily),
                            color: shape.color || '#111827',
                        }}
                    >
                        {shape.text}
                    </div>
                </foreignObject>
            )
        case 'checkbox': {
            const strokeColor = shape.color || '#000000'
            const side = shape.size * shortSidePx
            return (
                <svg key={key} x={`${shape.x * 100}%`} y={`${shape.y * 100}%`} width={side} height={side} viewBox="0 0 100 100" className="overflow-visible">
                    <rect x="0" y="0" width="100" height="100" rx="12" fill="white" stroke={strokeColor} strokeWidth="8" />
                    {shape.checked && (
                        <path d="M 20 50 L 42 72 L 80 25" fill="none" stroke={strokeColor} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                </svg>
            )
        }
        case 'stamp':
            return (
                <image
                    key={key}
                    href={shape.imageDataUrl}
                    x={`${shape.x * 100}%`}
                    y={`${shape.y * 100}%`}
                    width={`${shape.w * 100}%`}
                    height={`${shape.h * 100}%`}
                />
            )
        default:
            return null
    }
}
