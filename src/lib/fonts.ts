import type { TextFont } from '../types'

/** CSS font stacks matching the PDF standard fonts used by the export. */
export function fontStack(font: TextFont): string {
    if (font === 'TimesRoman') return '"Times New Roman", Times, serif'
    if (font === 'Courier') return '"Courier New", Courier, monospace'
    return 'Helvetica, Arial, sans-serif'
}
