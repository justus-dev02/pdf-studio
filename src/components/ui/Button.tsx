import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400',
    secondary: 'border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800',
    ghost: 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', className = '', type = 'button', ...props }, ref) {
    return (
        <button
            ref={ref}
            type={type}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
            {...props}
        />
    )
})

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
    /** Accessible name; also used as tooltip. */
    label: string
    icon: ReactNode
    active?: boolean
    showLabel?: boolean
}

/** Toolbar button with mandatory accessible name; `active` maps to aria-pressed for toggle buttons. */
export function IconButton({ label, icon, active, showLabel = false, className = '', type = 'button', ...props }: IconButtonProps) {
    return (
        <button
            type={type}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-neutral-200 bg-white/70 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/70 dark:hover:bg-neutral-800'
            } ${className}`}
            {...props}
        >
            {icon}
            {showLabel && <span>{label}</span>}
        </button>
    )
}
