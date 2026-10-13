import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, isPersistenceAvailable, loadSession, resetPersistenceConnection, saveSession } from './autosave'
import type { SourceMeta } from '../../types'

const meta = (key: string): SourceMeta => ({ key, name: `${key}.pdf`, pageCount: 1, sizeBytes: 3, encrypted: false })
const session = (keys: string[]) => ({
    pages: keys.map((key, i) => ({ id: `p${i}`, kind: 'pdf' as const, sourceKey: key, index: 0 })),
    overlays: { p0: [{ type: 'checkbox' as const, x: 0.1, y: 0.1, size: 0.03, checked: true }] },
    sources: keys.map(meta),
    activePage: 0,
})

beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    resetPersistenceConnection()
})

describe('autosave', () => {
    it('round-trips pages, overlays and source bytes', async () => {
        expect(isPersistenceAvailable()).toBe(true)
        await saveSession(session(['a']), () => new Uint8Array([1, 2, 3]))
        const restored = await loadSession()
        expect(restored?.session.pages).toEqual(session(['a']).pages)
        expect(restored?.session.overlays).toEqual(session(['a']).overlays)
        expect([...(restored?.bytes.get('a') ?? [])]).toEqual([1, 2, 3])
        expect(restored?.session.savedAt).toBeGreaterThan(0)
    })

    it('writes each source file only once and removes unreferenced ones', async () => {
        const getBytes = vi.fn((_key: string) => new Uint8Array([7]))
        await saveSession(session(['a']), getBytes)
        await saveSession(session(['a']), getBytes)
        await saveSession(session(['a', 'b']), getBytes)
        expect(getBytes.mock.calls.map(([key]) => key)).toEqual(['a', 'b'])

        await saveSession(session(['b']), getBytes)
        const restored = await loadSession()
        expect([...(restored?.bytes.keys() ?? [])]).toEqual(['b'])
    })

    it('returns nothing when no session or a source is missing', async () => {
        expect(await loadSession()).toBeNull()
        await saveSession(session(['a']), () => new Uint8Array([1]))
        await clearSession()
        expect(await loadSession()).toBeNull()
    })
})
