import { useRef, useState } from 'react'
import { CheckSquare, Hand, Highlighter, Image as ImageIcon, MousePointer, Pencil, PenTool, TextSelect, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../../components/ui/Button'
import SignatureModal from '../../components/ui/SignatureModal'
import { useDoc, useDocActions } from '../../store'
import { useT } from '../../i18n'
import type { Tool } from '../../types'
import { readImageAsDataUrl } from './images'

const TOOLS: { tool: Tool; icon: ReactNode }[] = [
    { tool: 'select', icon: <MousePointer className="h-4 w-4" aria-hidden /> },
    { tool: 'text-select', icon: <TextSelect className="h-4 w-4" aria-hidden /> },
    { tool: 'pan', icon: <Hand className="h-4 w-4" aria-hidden /> },
    { tool: 'highlight', icon: <Highlighter className="h-4 w-4" aria-hidden /> },
    { tool: 'pen', icon: <Pencil className="h-4 w-4" aria-hidden /> },
    { tool: 'text', icon: <Type className="h-4 w-4" aria-hidden /> },
    { tool: 'checkbox', icon: <CheckSquare className="h-4 w-4" aria-hidden /> },
]

export default function ToolPicker() {
    const t = useT()
    const tool = useDoc((s) => s.viewer.tool)
    const stampImage = useDoc((s) => s.document.stampImage)
    const actions = useDocActions()
    const stampInputRef = useRef<HTMLInputElement>(null)
    const [signatureOpen, setSignatureOpen] = useState(false)

    return (
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label={t.toolbar.label}>
            {TOOLS.map(({ tool: value, icon }) => (
                <IconButton key={value} label={t.toolbar.tools[value]} icon={icon} active={tool === value} onClick={() => actions.setTool(value)} />
            ))}
            <IconButton
                label={stampImage ? t.toolbar.tools.stamp : t.toolbar.uploadStamp}
                icon={<ImageIcon className="h-4 w-4" aria-hidden />}
                active={tool === 'stamp'}
                onClick={() => (stampImage && tool !== 'stamp' ? actions.setTool('stamp') : stampInputRef.current?.click())}
            />
            <input
                ref={stampInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    try {
                        actions.setStampImage(await readImageAsDataUrl(file))
                        actions.setTool('stamp')
                    } catch {
                        actions.setError(t.toolbar.unsupportedImage)
                    }
                }}
            />
            <IconButton label={t.toolbar.signature} icon={<PenTool className="h-4 w-4" aria-hidden />} showLabel onClick={() => setSignatureOpen(true)} />
            {signatureOpen && <SignatureModal onClose={() => setSignatureOpen(false)} />}
        </div>
    )
}
