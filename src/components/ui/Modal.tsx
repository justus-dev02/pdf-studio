import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT } from '../../i18n'

type ModalProps = {
    title: ReactNode
    description?: ReactNode
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    size?: 'sm' | 'md' | 'lg'
    /** Element to focus first; defaults to the first focusable element in the dialog. */
    initialFocusRef?: React.RefObject<HTMLElement>
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-3xl' }

/**
 * Accessible modal dialog: role="dialog" + aria-modal, labelled by its title,
 * focus moves into the dialog, Tab is trapped inside, Escape closes, and focus
 * returns to the element that opened it.
 */
export default function Modal({ title, description, onClose, children, footer, size = 'md', initialFocusRef }: ModalProps) {
    const t = useT()
    const dialogRef = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const descriptionId = useId()
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null
        const dialog = dialogRef.current
        const target = initialFocusRef?.current ?? dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog
        target?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                onCloseRef.current()
                return
            }
            if (event.key !== 'Tab' || !dialog) return
            const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[hidden]'))
            if (focusable.length === 0) {
                event.preventDefault()
                return
            }
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown, true)
        return () => {
            document.removeEventListener('keydown', onKeyDown, true)
            previouslyFocused?.focus?.()
        }
    }, [initialFocusRef])

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`flex max-h-[90vh] w-full ${sizeClass[size]} flex-col rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100`}
            >
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                    <div>
                        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
                        {description && <p id={descriptionId} className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-neutral-800" aria-label={t.common.close}>
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">{footer}</div>}
            </div>
        </div>,
        document.body
    )
}
