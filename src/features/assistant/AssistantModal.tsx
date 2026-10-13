import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Modal from '../../components/ui/Modal'
import { describeError, useT } from '../../i18n'
import { useDocumentText } from './useDocumentText'
import type { DocumentTextState } from './useDocumentText'
import { useLlmSettings } from './useLlmSettings'
import AnalysisTab from './tabs/AnalysisTab'
import SummaryTab from './tabs/SummaryTab'
import ChatTab from './tabs/ChatTab'
import MarkdownTab from './tabs/MarkdownTab'
import ProviderSettingsTab from './tabs/ProviderSettingsTab'
import type { DocumentPageText } from '../../services/pdf'

type TabId = 'analysis' | 'summary' | 'chat' | 'markdown' | 'settings'
const TABS: TabId[] = ['analysis', 'summary', 'chat', 'markdown', 'settings']

/** Tabs that need extracted text; the settings tab works without a document. */
const NEEDS_TEXT = new Set<TabId>(['analysis', 'summary', 'chat', 'markdown'])

export default function AssistantModal({ onClose }: { onClose: () => void }) {
    const t = useT()
    const baseId = useId()
    const [active, setActive] = useState<TabId>('analysis')
    const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ analysis: null, summary: null, chat: null, markdown: null, settings: null })
    const text = useDocumentText()
    const llm = useLlmSettings()

    // WAI-ARIA tabs pattern: arrow keys move between tabs, Home/End jump to the ends.
    const onTabKeyDown = (event: KeyboardEvent) => {
        const index = TABS.indexOf(active)
        const next =
            event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
                : event.key === 'ArrowLeft' ? TABS[(index - 1 + TABS.length) % TABS.length]
                    : event.key === 'Home' ? TABS[0]
                        : event.key === 'End' ? TABS[TABS.length - 1]
                            : null
        if (!next) return
        event.preventDefault()
        setActive(next)
        tabRefs.current[next]?.focus()
    }

    return (
        <Modal title={t.assistant.title} description={t.assistant.subtitle} onClose={onClose} size="lg">
            <div role="tablist" aria-label={t.assistant.title} className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800" onKeyDown={onTabKeyDown}>
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        ref={(el) => {
                            tabRefs.current[tab] = el
                        }}
                        type="button"
                        role="tab"
                        id={`${baseId}-tab-${tab}`}
                        aria-selected={active === tab}
                        aria-controls={`${baseId}-panel-${tab}`}
                        tabIndex={active === tab ? 0 : -1}
                        onClick={() => setActive(tab)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${active === tab ? 'bg-indigo-600 text-white' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
                    >
                        {t.assistant.tabs[tab]}
                    </button>
                ))}
            </div>
            <div role="tabpanel" id={`${baseId}-panel-${active}`} aria-labelledby={`${baseId}-tab-${active}`} tabIndex={0} className="focus-visible:outline-none">
                {NEEDS_TEXT.has(active) ? (
                    <TextGate state={text}>
                        {(pages) => (
                            <>
                                {active === 'analysis' && <AnalysisTab pages={pages} />}
                                {active === 'summary' && <SummaryTab pages={pages} llm={llm} />}
                                {active === 'chat' && <ChatTab pages={pages} llm={llm} />}
                                {active === 'markdown' && <MarkdownTab />}
                            </>
                        )}
                    </TextGate>
                ) : (
                    <ProviderSettingsTab llm={llm} />
                )}
            </div>
        </Modal>
    )
}

function TextGate({ state, children }: { state: DocumentTextState; children: (pages: DocumentPageText[]) => React.ReactNode }) {
    const t = useT()
    switch (state.status) {
        case 'idle':
        case 'empty-document':
            return <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.assistant.noDocument}</p>
        case 'loading':
            return (
                <div role="status" className="space-y-2">
                    <p className="text-sm">{t.assistant.extracting(state.done, state.total)}</p>
                    <progress className="w-full" value={state.done} max={state.total} />
                </div>
            )
        case 'error':
            return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{describeError(state.error, t)}</p>
        case 'ready':
            if (!state.hasText) return <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.assistant.noText}</p>
            return <>{children(state.pages)}</>
    }
}
