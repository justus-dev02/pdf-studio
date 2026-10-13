import type { PdfTextItem } from '../../../services/pdf'

export type TextLayerProps = {
    /** Items in PDF points at scale 1. */
    items: PdfTextItem[]
    zoom: number
    enabled: boolean
}

/** Transparent, selectable text positioned over the canvas (copy & paste from the PDF). */
export default function TextLayer({ items, zoom, enabled }: TextLayerProps) {
    if (!enabled || items.length === 0) return null

    return (
        <div className="pdf-text-layer absolute inset-0">
            {items.map((item, idx) => (
                <span
                    key={idx}
                    className="absolute select-text"
                    style={{
                        left: `${item.x * zoom}px`,
                        top: `${item.y * zoom}px`,
                        width: `${item.width * zoom}px`,
                        height: `${item.height * zoom}px`,
                        fontSize: `${item.height * zoom}px`,
                        lineHeight: 1,
                        whiteSpace: 'pre',
                    }}
                >
                    {item.text}
                </span>
            ))}
        </div>
    )
}
