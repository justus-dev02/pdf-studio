import type { RefObject } from 'react'
import type { TextBox } from '../../../types'
import { fontStack } from '../../../lib/fonts'

export type TextEditorOverlayProps = {
    shape: TextBox
    placeholder: string
    label: string
    zoom: number
    value: string
    onChange: (value: string) => void
    onCommit: () => void
    textAreaRef: RefObject<HTMLTextAreaElement>
}

export default function TextEditorOverlay({ shape, placeholder, label, zoom, value, onChange, onCommit, textAreaRef }: TextEditorOverlayProps) {
    return (
        <textarea
            ref={textAreaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    onCommit()
                }
            }}
            placeholder={placeholder}
            aria-label={label}
            className="absolute border border-blue-400 rounded-md bg-white/90 text-neutral-900 shadow-lg resize pointer-events-auto focus:outline-none dark:bg-neutral-900/90 dark:text-neutral-100 dark:border-blue-300"
            style={{
                left: `${shape.x * 100}%`,
                top: `${shape.y * 100}%`,
                width: `${shape.w * 100}%`,
                height: `${shape.h * 100}%`,
                fontSize: `${shape.fontSize * zoom}px`,
                lineHeight: 1.2,
                // Matches the 2pt inset used by the PDF export.
                padding: `0 ${2 * zoom}px`,
                fontFamily: fontStack(shape.fontFamily),
            }}
        />
    )
}
