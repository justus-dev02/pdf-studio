export type Tool = 'select' | 'pan' | 'highlight' | 'pen' | 'text' | 'text-select' | 'checkbox' | 'stamp'
export type FitMode = 'manual' | 'width' | 'page'
export type TextFont = 'Helvetica' | 'TimesRoman' | 'Courier'
export type PaperFormat = 'A4' | 'Letter' | 'A3' | 'Custom'

export type PaperDimensions = {
    width: number
    height: number
}

/** Page sizes in PDF points (1/72 inch). */
export const PAPER_PRESETS: Record<PaperFormat, PaperDimensions> = {
    A4: { width: 595.28, height: 841.89 },
    Letter: { width: 612, height: 792 },
    A3: { width: 841.89, height: 1190.55 },
    Custom: { width: 600, height: 800 },
}

/** Stable identifier of a page inside the editor. Never derived from the page position. */
export type PageId = string

/** Identifier of a loaded PDF file in the source registry (see services/pdf/sourceRegistry). */
export type SourceKey = string

/**
 * A page of the edited document. Pages never carry binary data, only a reference
 * to a registered source. This keeps undo snapshots and persisted state small.
 */
export type PageRef =
    | { id: PageId; kind: 'pdf'; sourceKey: SourceKey; index: number }
    | { id: PageId; kind: 'blank'; format: PaperFormat; customDimensions?: PaperDimensions }

/** Metadata of a loaded PDF file. The bytes live in the source registry, not in the store. */
export type SourceMeta = {
    key: SourceKey
    name: string
    pageCount: number
    sizeBytes: number
    /** True if the file contains an /Encrypt dictionary (password or owner restrictions). */
    encrypted: boolean
}

export type Highlight = { type: 'highlight'; x: number; y: number; w: number; h: number; opacity: number; color?: string }
export type PenPath = { type: 'pen'; points: { x: number; y: number }[]; width: number; color?: string }
export type TextBox = {
    type: 'text'
    x: number
    y: number
    w: number
    h: number
    text: string
    fontSize: number
    fontFamily: TextFont
    color?: string
}
export type Checkbox = { type: 'checkbox'; x: number; y: number; size: number; checked: boolean; color?: string }
export type Stamp = { type: 'stamp'; x: number; y: number; w: number; h: number; imageDataUrl: string }

/** All coordinates are normalized to the page (0..1, origin top-left). */
export type Shape = Highlight | PenPath | TextBox | Checkbox | Stamp

export type PageOverlays = Record<PageId, Shape[]>

export type SearchMatch = {
    pageId: PageId
    pageIndex: number
    text: string
    /** Normalized (0..1) bounding box of the matching text item. */
    x: number
    y: number
    width: number
    height: number
}
