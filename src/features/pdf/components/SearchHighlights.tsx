import type { SearchMatch } from '../../../types'

export type SearchHighlightsProps = {
    matches: SearchMatch[]
    /** Index into `matches` of the current result, or -1. */
    currentIndex: number
    label: string
}

/** Highlights search results of the visible page; the current result is emphasized. */
export default function SearchHighlights({ matches, currentIndex, label }: SearchHighlightsProps) {
    if (matches.length === 0) return null
    return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {matches.map((match, idx) => (
                <rect
                    key={idx}
                    data-current={idx === currentIndex || undefined}
                    x={`${match.x * 100}%`}
                    y={`${match.y * 100}%`}
                    width={`${match.width * 100}%`}
                    height={`${match.height * 100}%`}
                    rx={2}
                    fill={idx === currentIndex ? '#f97316' : '#facc15'}
                    fillOpacity={idx === currentIndex ? 0.45 : 0.3}
                    stroke={idx === currentIndex ? '#ea580c' : 'none'}
                >
                    <title>{label}</title>
                </rect>
            ))}
        </svg>
    )
}
