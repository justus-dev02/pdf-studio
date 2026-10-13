import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useDoc, useDocActions } from '../../store'
import { useT } from '../../i18n'

const NOTICE_TIMEOUT_MS = 6000

/** Error messages stay until dismissed (role="alert"); notices auto-hide (role="status"). */
export default function Toasts() {
    const t = useT()
    const error = useDoc((s) => s.ui.error)
    const notice = useDoc((s) => s.ui.notice)
    const { setError, setNotice } = useDocActions()

    useEffect(() => {
        if (!notice) return
        const timer = setTimeout(() => setNotice(undefined), NOTICE_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [notice, setNotice])

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex max-w-sm flex-col gap-2">
            <div role="status" aria-live="polite">
                {notice && (
                    <Toast tone="info" message={notice} onClose={() => setNotice(undefined)} closeLabel={t.common.dismiss} />
                )}
            </div>
            <div role="alert" aria-live="assertive">
                {error && <Toast tone="error" message={error} onClose={() => setError(undefined)} closeLabel={t.common.dismiss} />}
            </div>
        </div>
    )
}

function Toast({ tone, message, onClose, closeLabel }: { tone: 'info' | 'error'; message: string; onClose: () => void; closeLabel: string }) {
    const toneClass =
        tone === 'error'
            ? 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-300'
            : 'border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200'
    return (
        <div className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white/95 px-4 py-3 text-sm shadow-lg dark:bg-neutral-900/95 ${toneClass}`}>
            <p className="flex-1">{message}</p>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="rounded p-0.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-neutral-200">
                <X className="h-4 w-4" aria-hidden />
            </button>
        </div>
    )
}
