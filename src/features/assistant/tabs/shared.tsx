import type { ReactNode } from 'react'

export function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
            <h3 className="mb-3 text-sm font-semibold">{title}</h3>
            {children}
        </section>
    )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900" title={hint}>
            <div className="text-[11px] text-neutral-600 dark:text-neutral-400">{label}</div>
            <div className="text-sm font-semibold">{value}</div>
            {hint && <div className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">{hint}</div>}
        </div>
    )
}
