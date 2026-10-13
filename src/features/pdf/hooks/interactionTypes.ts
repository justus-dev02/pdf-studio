import type { PageId } from '../../../types'

export type InteractionMode = 'idle' | 'drawing' | 'panning' | 'dragging' | 'resizing' | 'pinching'
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'
export type TextEditingState = { pageId: PageId; index: number }
