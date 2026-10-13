import { forwardRef, useImperativeHandle, useRef } from 'react'
import { FilePlus2, FolderOpen, Loader2, Save } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import { useDocActions, useHasDocument } from '../../store'
import { useT } from '../../i18n'
import type { PaperFormat } from '../../types'
import { useDocumentCommands } from '../document/DocumentCommands'

export type FileControlsHandle = { openFilePicker: () => void }

const BLANK_FORMATS: PaperFormat[] = ['A4', 'Letter', 'A3']

const FileControls = forwardRef<FileControlsHandle>(function FileControls(_props, ref) {
    const t = useT()
    const openRef = useRef<HTMLInputElement>(null)
    const appendRef = useRef<HTMLInputElement>(null)
    const { load, isLoading, exportDocument, isExporting } = useDocumentCommands()
    const { addBlankPage } = useDocActions()
    const hasDocument = useHasDocument()

    useImperativeHandle(ref, () => ({ openFilePicker: () => openRef.current?.click() }), [])

    const onFile = (mode: 'open' | 'append') => (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void load(file, mode)
    }

    return (
        <div className="flex items-center gap-1.5" role="group" aria-label={t.toolbar.open}>
            <IconButton
                label={isLoading ? t.toolbar.loading : t.toolbar.open}
                icon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FolderOpen className="h-4 w-4" aria-hidden />}
                onClick={() => openRef.current?.click()}
                disabled={isLoading}
            />
            <input ref={openRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile('open')} data-testid="open-pdf-input" />
            <IconButton label={t.toolbar.append} icon={<FilePlus2 className="h-4 w-4" aria-hidden />} onClick={() => appendRef.current?.click()} disabled={isLoading || !hasDocument} />
            <input ref={appendRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile('append')} data-testid="append-pdf-input" />
            <select
                aria-label={t.toolbar.addBlank}
                title={t.toolbar.addBlank}
                value=""
                onChange={(event) => {
                    if (event.target.value) addBlankPage(event.target.value as PaperFormat)
                }}
                className="rounded-xl border border-neutral-200 bg-white/70 px-2 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/70"
            >
                <option value="" disabled>
                    {t.toolbar.addBlank}
                </option>
                {BLANK_FORMATS.map((format) => (
                    <option key={format} value={format}>
                        {t.toolbar.blankFormat(format)}
                    </option>
                ))}
            </select>
            <IconButton
                label={isExporting ? t.toolbar.exporting : t.toolbar.export}
                icon={isExporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                onClick={() => void exportDocument()}
                disabled={!hasDocument || isExporting}
            />
        </div>
    )
})

export default FileControls
