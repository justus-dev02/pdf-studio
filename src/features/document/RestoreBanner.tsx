import { History } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useT } from '../../i18n'
import type { RestoredSession } from '../../services/persistence/autosave'

type RestoreBannerProps = {
    candidate: RestoredSession
    onRestore: () => void
    onDiscard: () => void
}

export default function RestoreBanner({ candidate, onRestore, onDiscard }: RestoreBannerProps) {
    const t = useT()
    const minutes = Math.floor((Date.now() - candidate.session.savedAt) / 60_000)
    return (
        <div role="region" aria-label={t.restore.title} className="flex flex-wrap items-center gap-3 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100">
            <History className="h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">
                <strong>{t.restore.title}:</strong> {t.restore.body(candidate.session.pages.length, minutes)}
            </p>
            <Button variant="primary" onClick={onRestore}>{t.restore.restore}</Button>
            <Button onClick={onDiscard}>{t.restore.discard}</Button>
        </div>
    )
}
