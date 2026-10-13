import { useId, useRef, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useT } from '../../i18n'

type PasswordDialogProps = {
    reason: 'missing' | 'incorrect'
    onSubmit: (password: string) => void
    onCancel: () => void
}

export default function PasswordDialog({ reason, onSubmit, onCancel }: PasswordDialogProps) {
    const t = useT()
    const [value, setValue] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const formId = useId()
    const inputId = useId()

    return (
        <Modal
            size="sm"
            title={t.password.title}
            description={reason === 'incorrect' ? t.password.incorrect : t.password.missing}
            onClose={onCancel}
            initialFocusRef={inputRef}
            footer={
                <>
                    <Button onClick={onCancel}>{t.common.cancel}</Button>
                    <Button variant="primary" type="submit" form={formId} disabled={!value}>
                        {t.password.unlock}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                onSubmit={(event) => {
                    event.preventDefault()
                    if (value) onSubmit(value)
                }}
            >
                <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    {t.password.label}
                </label>
                <input
                    ref={inputRef}
                    id={inputId}
                    type="password"
                    autoComplete="off"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    aria-invalid={reason === 'incorrect'}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
            </form>
        </Modal>
    )
}
