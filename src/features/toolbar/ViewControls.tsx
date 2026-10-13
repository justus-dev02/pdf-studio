import { ChevronLeft, ChevronRight, Maximize2, Palette, Redo2, StretchHorizontal, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '../../components/ui/Button'
import { FONT_SIZE_MAX, FONT_SIZE_MIN, useActivePage, useCanUndoRedo, useDoc, useDocActions } from '../../store'
import { useT } from '../../i18n'
import type { TextFont } from '../../types'

const COLORS = ['#eab308', '#ef4444', '#3b82f6', '#10b981', '#111827']
const ZOOM_STEP = 1.2

export function ColorPicker() {
    const t = useT()
    const activeColor = useDoc((s) => s.viewer.activeColor)
    const { setActiveColor } = useDocActions()
    return (
        <div role="radiogroup" aria-label={t.toolbar.colors} className="flex items-center gap-1 px-1">
            <Palette className="mr-0.5 h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" aria-hidden />
            {COLORS.map((hex) => (
                <button
                    key={hex}
                    type="button"
                    role="radio"
                    aria-checked={activeColor === hex}
                    aria-label={t.toolbar.colorNames[hex] ?? hex}
                    title={t.toolbar.colorNames[hex] ?? hex}
                    onClick={() => setActiveColor(hex)}
                    className={`h-5 w-5 rounded-full border border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeColor === hex ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                    style={{ backgroundColor: hex }}
                />
            ))}
        </div>
    )
}

export function HistoryControls() {
    const t = useT()
    const { canUndo, canRedo } = useCanUndoRedo()
    const { undo, redo } = useDocActions()
    return (
        <div className="flex items-center gap-1" role="group" aria-label={t.toolbar.undo}>
            <IconButton label={t.toolbar.undo} icon={<Undo2 className="h-4 w-4" aria-hidden />} onClick={undo} disabled={!canUndo} />
            <IconButton label={t.toolbar.redo} icon={<Redo2 className="h-4 w-4" aria-hidden />} onClick={redo} disabled={!canRedo} />
        </div>
    )
}

export function ZoomControls() {
    const t = useT()
    const { zoom, fitMode } = useDoc(useShallow((s) => ({ zoom: s.viewer.zoom, fitMode: s.viewer.fitMode })))
    const { setZoom, setFitMode } = useDocActions()
    return (
        <div className="flex items-center gap-1" role="group" aria-label={t.toolbar.zoomLevel}>
            <IconButton label={t.toolbar.zoomOut} icon={<ZoomOut className="h-4 w-4" aria-hidden />} onClick={() => setZoom(zoom / ZOOM_STEP)} />
            <output aria-label={t.toolbar.zoomLevel} className="w-12 select-none text-center font-mono text-xs">
                {Math.round(zoom * 100)}%
            </output>
            <IconButton label={t.toolbar.zoomIn} icon={<ZoomIn className="h-4 w-4" aria-hidden />} onClick={() => setZoom(zoom * ZOOM_STEP)} />
            <IconButton label={t.toolbar.fitWidth} icon={<StretchHorizontal className="h-4 w-4" aria-hidden />} active={fitMode === 'width'} onClick={() => setFitMode('width')} />
            <IconButton label={t.toolbar.fitPage} icon={<Maximize2 className="h-4 w-4" aria-hidden />} active={fitMode === 'page'} onClick={() => setFitMode('page')} />
        </div>
    )
}

export function PageNavigation() {
    const t = useT()
    const { index, count } = useActivePage()
    const { setActivePage } = useDocActions()
    return (
        <div className="flex items-center gap-1" role="group" aria-label={t.viewer.label}>
            <IconButton label={t.toolbar.prevPage} icon={<ChevronLeft className="h-4 w-4" aria-hidden />} onClick={() => setActivePage(index - 1)} disabled={count === 0 || index === 0} />
            <span className="w-16 select-none text-center font-mono text-xs" aria-live="polite">
                {count ? t.toolbar.pageIndicator(index + 1, count) : '0/0'}
            </span>
            <IconButton label={t.toolbar.nextPage} icon={<ChevronRight className="h-4 w-4" aria-hidden />} onClick={() => setActivePage(index + 1)} disabled={count === 0 || index >= count - 1} />
        </div>
    )
}

export function TextControls() {
    const t = useT()
    const textSettings = useDoc((s) => s.textSettings)
    const { setTextSettings } = useDocActions()
    return (
        <div className="flex items-center gap-1.5">
            <select
                value={textSettings.fontFamily}
                onChange={(e) => setTextSettings({ fontFamily: e.target.value as TextFont })}
                aria-label={t.toolbar.font}
                title={t.toolbar.font}
                className="rounded-xl border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/70"
            >
                <option value="Helvetica">Helvetica</option>
                <option value="TimesRoman">Times</option>
                <option value="Courier">Courier</option>
            </select>
            <input
                type="number"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={textSettings.fontSize}
                onChange={(e) => setTextSettings({ fontSize: Number(e.target.value) })}
                aria-label={t.toolbar.fontSize}
                title={t.toolbar.fontSize}
                className="w-14 rounded-xl border border-neutral-200 bg-white/70 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900/70"
            />
        </div>
    )
}
