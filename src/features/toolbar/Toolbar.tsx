import { lazy, Suspense, useRef, useState } from 'react'
import { Bot, Languages, Loader2, Moon, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Sun } from 'lucide-react'
import { IconButton } from '../../components/ui/Button'
import { useDoc, useDocActions, useHasDocument } from '../../store'
import { describeError, LOCALES, useT } from '../../i18n'
import type { Locale } from '../../i18n'
import { detectFormFields } from '../../services/pdf'
import SearchBar from '../search/SearchBar'
import { useDocumentCommands } from '../document/DocumentCommands'
import FileControls from './FileControls'
import type { FileControlsHandle } from './FileControls'
import ToolPicker from './ToolPicker'
import { ColorPicker, HistoryControls, PageNavigation, TextControls, ZoomControls } from './ViewControls'
import { useGlobalShortcuts } from './useGlobalShortcuts'

// The assistant (tokenizer, LLM clients, analysis UI) is not needed for editing: load it on demand.
const AssistantModal = lazy(() => import('../assistant/AssistantModal'))

const Divider = () => <div className="mx-1 h-7 w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden />

export default function Toolbar() {
    const t = useT()
    const fileControls = useRef<FileControlsHandle>(null)
    const { exportDocument } = useDocumentCommands()
    const [searchToken, setSearchToken] = useState(0)
    const [searchOpen, setSearchOpen] = useState(false)
    const [assistantOpen, setAssistantOpen] = useState(false)

    const openSearch = () => {
        setSearchOpen(true)
        setSearchToken((n) => n + 1)
    }
    const { setSearchQuery } = useDocActions()
    const closeSearch = () => {
        setSearchOpen(false)
        setSearchQuery('')
    }

    useGlobalShortcuts({
        openSearch,
        openFile: () => fileControls.current?.openFilePicker(),
        exportDocument: () => void exportDocument(),
    })

    return (
        <header className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white/85 p-2 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/85">
            <SidebarToggle />
            <FileControls ref={fileControls} />
            <Divider />
            <ToolPicker />
            <ColorPicker />
            <Divider />
            <HistoryControls />
            <ZoomControls />
            <PageNavigation />
            <TextControls />
            <div className="ml-auto flex items-center gap-1.5">
                <IconButton label={t.toolbar.search} icon={<Search className="h-4 w-4" aria-hidden />} active={searchOpen} onClick={() => (searchOpen ? closeSearch() : openSearch())} />
                <DetectFormsButton />
                <IconButton
                    label={t.toolbar.assistant}
                    icon={<Bot className="h-4 w-4" aria-hidden />}
                    showLabel
                    onClick={() => setAssistantOpen(true)}
                    className="!border-indigo-600 !bg-indigo-600 !text-white hover:!bg-indigo-700"
                />
                <LanguageSelect />
                <ThemeToggle />
            </div>
            {searchOpen && <SearchBar onClose={closeSearch} focusToken={searchToken} />}
            {assistantOpen && (
                <Suspense fallback={null}>
                    <AssistantModal onClose={() => setAssistantOpen(false)} />
                </Suspense>
            )}
        </header>
    )
}

function SidebarToggle() {
    const t = useT()
    const open = useDoc((s) => s.ui.sidebarOpen)
    const { toggleSidebar } = useDocActions()
    return (
        <IconButton
            label={t.toolbar.toggleSidebar}
            icon={open ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
            active={open}
            aria-controls="page-sidebar"
            onClick={toggleSidebar}
        />
    )
}

function DetectFormsButton() {
    const t = useT()
    const hasDocument = useHasDocument()
    const actions = useDocActions()
    const [running, setRunning] = useState(false)

    const run = async () => {
        setRunning(true)
        try {
            const fields = await detectFormFields(useDoc.getState().document.pages)
            if (fields.length === 0) {
                actions.setNotice(t.toolbar.formsNone)
                return
            }
            actions.addShapes(fields.map((f) => ({ pageId: f.pageId, shape: f.shape })))
            actions.setNotice(t.toolbar.formsAdded(fields.length))
        } catch (error) {
            actions.setError(describeError(error, t))
        } finally {
            setRunning(false)
        }
    }

    return (
        <IconButton
            label={t.toolbar.detectForms}
            title={t.toolbar.detectFormsHint}
            icon={running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            onClick={() => void run()}
            disabled={!hasDocument || running}
        />
    )
}

function LanguageSelect() {
    const t = useT()
    const locale = useDoc((s) => s.ui.locale)
    const { setLocale } = useDocActions()
    return (
        <label className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/70">
            <Languages className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{t.toolbar.language}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="bg-transparent">
                {(Object.keys(LOCALES) as Locale[]).map((key) => (
                    <option key={key} value={key}>
                        {LOCALES[key].label}
                    </option>
                ))}
            </select>
        </label>
    )
}

function ThemeToggle() {
    const t = useT()
    const dark = useDoc((s) => s.ui.dark)
    const { toggleDark } = useDocActions()
    return (
        <IconButton
            label={dark ? t.toolbar.themeToLight : t.toolbar.themeToDark}
            icon={dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            onClick={toggleDark}
        />
    )
}
