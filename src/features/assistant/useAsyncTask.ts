import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncTaskState<T> =
    | { status: 'idle' }
    | { status: 'running' }
    | { status: 'done'; value: T }
    | { status: 'error'; error: unknown }

/**
 * Runs an abortable async task triggered by the user. Starting the task again (or unmounting)
 * aborts the previous run, and results of aborted runs are dropped.
 */
export function useAsyncTask<T, A extends unknown[]>(task: (signal: AbortSignal, ...args: A) => Promise<T>) {
    const [state, setState] = useState<AsyncTaskState<T>>({ status: 'idle' })
    const controller = useRef<AbortController | null>(null)
    const taskRef = useRef(task)
    taskRef.current = task

    useEffect(() => () => controller.current?.abort(), [])

    const run = useCallback(async (...args: A) => {
        controller.current?.abort()
        const current = new AbortController()
        controller.current = current
        setState({ status: 'running' })
        try {
            const value = await taskRef.current(current.signal, ...args)
            if (!current.signal.aborted) setState({ status: 'done', value })
        } catch (error) {
            if (!current.signal.aborted) setState({ status: 'error', error })
        }
    }, [])

    const cancel = useCallback(() => {
        controller.current?.abort()
        setState({ status: 'idle' })
    }, [])

    return { state, run, cancel }
}
