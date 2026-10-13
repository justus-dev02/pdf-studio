import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { isTypingTarget, KEYBOARD_STEP, usePdfKeyboardShortcuts } from './usePdfKeyboardShortcuts'
import type { KeyboardShortcutHandlers } from './usePdfKeyboardShortcuts'

function setup(overrides: Partial<KeyboardShortcutHandlers> = {}) {
    const scope = document.createElement('div')
    document.body.appendChild(scope)
    const handlers: KeyboardShortcutHandlers = {
        pagesCount: 3,
        activePage: 1,
        shapesCount: 3,
        selectedIndex: null,
        editing: false,
        setActivePage: vi.fn(),
        selectShape: vi.fn(),
        moveSelection: vi.fn(),
        deleteSelection: vi.fn(),
        editSelection: vi.fn(),
        commitEdit: vi.fn(),
        ...overrides,
    }
    renderHook(() => usePdfKeyboardShortcuts({ current: scope }, handlers))
    return { scope, handlers }
}

describe('usePdfKeyboardShortcuts', () => {
    it('changes pages with PageUp/PageDown and arrows when nothing is selected', () => {
        const { scope, handlers } = setup()
        fireEvent.keyDown(scope, { key: 'PageDown' })
        fireEvent.keyDown(scope, { key: 'ArrowLeft' })
        expect(handlers.setActivePage).toHaveBeenNthCalledWith(1, 2)
        expect(handlers.setActivePage).toHaveBeenNthCalledWith(2, 0)
    })

    it('cycles through annotations with [ and ]', () => {
        const none = setup()
        fireEvent.keyDown(none.scope, { key: ']' })
        fireEvent.keyDown(none.scope, { key: '[' })
        expect(none.handlers.selectShape).toHaveBeenNthCalledWith(1, 0)
        expect(none.handlers.selectShape).toHaveBeenNthCalledWith(2, 2)

        const last = setup({ selectedIndex: 2 })
        fireEvent.keyDown(last.scope, { key: ']' })
        expect(last.handlers.selectShape).toHaveBeenCalledWith(0)
    })

    it('moves, edits, deletes and deselects the selected annotation', () => {
        const { scope, handlers } = setup({ selectedIndex: 1 })
        fireEvent.keyDown(scope, { key: 'ArrowRight' })
        fireEvent.keyDown(scope, { key: 'ArrowUp', shiftKey: true })
        expect(handlers.moveSelection).toHaveBeenNthCalledWith(1, KEYBOARD_STEP, 0)
        expect(handlers.moveSelection).toHaveBeenNthCalledWith(2, 0, -KEYBOARD_STEP * 10)
        fireEvent.keyDown(scope, { key: 'Enter' })
        fireEvent.keyDown(scope, { key: 'Delete' })
        fireEvent.keyDown(scope, { key: 'Escape' })
        expect(handlers.editSelection).toHaveBeenCalled()
        expect(handlers.deleteSelection).toHaveBeenCalled()
        expect(handlers.selectShape).toHaveBeenCalledWith(null)
        expect(handlers.setActivePage).not.toHaveBeenCalled()
    })

    it('only commits while editing text and ignores typing in inputs', () => {
        const editing = setup({ editing: true, selectedIndex: 0 })
        fireEvent.keyDown(editing.scope, { key: 'Delete' })
        fireEvent.keyDown(editing.scope, { key: 'Escape' })
        expect(editing.handlers.deleteSelection).not.toHaveBeenCalled()
        expect(editing.handlers.commitEdit).toHaveBeenCalledOnce()

        const typing = setup({ selectedIndex: 0 })
        const input = document.createElement('input')
        typing.scope.appendChild(input)
        fireEvent.keyDown(input, { key: 'Backspace' })
        expect(typing.handlers.deleteSelection).not.toHaveBeenCalled()
        expect(isTypingTarget(input)).toBe(true)
        expect(isTypingTarget(null)).toBe(false)
    })

    it('does not react to keys outside its scope', () => {
        const { handlers } = setup()
        fireEvent.keyDown(document.body, { key: 'PageDown' })
        expect(handlers.setActivePage).not.toHaveBeenCalled()
    })
})
