import { useCallback, useEffect, useRef, useState } from 'react'
import { useDoc, useDocActions } from '../../store'
import { useT } from '../../i18n'
import { getSource, openPdfSource } from '../../services/pdf'
import { clearSession, isPersistenceAvailable, loadSession, saveSession } from '../../services/persistence/autosave'
import type { RestoredSession } from '../../services/persistence/autosave'

export const AUTOSAVE_DELAY_MS = 1500

/**
 * Restores the last session on startup (after the user confirms) and keeps it up to date.
 *
 * - Saving is debounced and only triggered by document changes (pages, overlays, sources).
 * - Sources opened with a password are never persisted: storing the decrypted bytes or the
 *   password would defeat the protection.
 * - An empty editor never overwrites a stored session.
 */
export function useAutosave() {
    const t = useT()
    const actions = useDocActions()
    const [candidate, setCandidate] = useState<RestoredSession | null>(null)
    const warnedAboutPassword = useRef(false)

    useEffect(() => {
        if (!isPersistenceAvailable()) return
        let active = true
        loadSession()
            .then((session) => {
                if (active && session && useDoc.getState().document.pages.length === 0) setCandidate(session)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (!isPersistenceAvailable()) return
        let timer: ReturnType<typeof setTimeout> | null = null

        const unsubscribe = useDoc.subscribe((state, prev) => {
            const doc = state.document
            if (doc.pages === prev.document.pages && doc.overlays === prev.document.overlays && doc.sources === prev.document.sources) return
            if (doc.pages.length === 0) return
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                const { pages, overlays, sources } = useDoc.getState().document
                const metas = Object.values(sources)
                if (metas.some((s) => getSource(s.key).password)) {
                    if (!warnedAboutPassword.current) actions.setNotice(t.restore.passwordSkipped)
                    warnedAboutPassword.current = true
                    return
                }
                setCandidate(null)
                saveSession({ pages, overlays, sources: metas, activePage: useDoc.getState().viewer.activePage }, (key) => getSource(key).bytes).catch(() => {
                    // Quota exceeded or storage disabled: autosave is best effort and must never break editing.
                })
            }, AUTOSAVE_DELAY_MS)
        })

        return () => {
            unsubscribe()
            if (timer) clearTimeout(timer)
        }
    }, [actions, t])

    const restore = useCallback(async () => {
        if (!candidate) return
        try {
            for (const meta of candidate.session.sources) {
                const bytes = candidate.bytes.get(meta.key)
                if (bytes) await openPdfSource(bytes, meta.name, { key: meta.key })
            }
            actions.restoreSession(candidate.session)
        } catch {
            actions.setError(t.restore.failed)
        } finally {
            setCandidate(null)
        }
    }, [actions, candidate, t])

    const discard = useCallback(async () => {
        setCandidate(null)
        await clearSession().catch(() => undefined)
    }, [])

    return { candidate, restore, discard }
}
