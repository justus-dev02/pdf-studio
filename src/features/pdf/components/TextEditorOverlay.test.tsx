import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TextEditorOverlay from './TextEditorOverlay'
import type { TextBox } from '../../../types'

describe('TextEditorOverlay component', () => {
    it('renders textarea with value and triggers onChange / onCommit', () => {
        const shape: TextBox = { type: 'text', x: 0.1, y: 0.1, w: 0.3, h: 0.1, text: 'Initial', fontSize: 14, fontFamily: 'Helvetica' }
        const onChange = vi.fn()
        const onCommit = vi.fn()
        const ref = createRef<HTMLTextAreaElement>()

        render(
            <TextEditorOverlay
                shape={shape}
                placeholder="Text eingeben"
                label="Text bearbeiten"
                zoom={1}
                value="Editing Text"
                onChange={onChange}
                onCommit={onCommit}
                textAreaRef={ref}
            />
        )

        const textarea = screen.getByPlaceholderText('Text eingeben') as HTMLTextAreaElement
        expect(textarea.value).toBe('Editing Text')

        fireEvent.change(textarea, { target: { value: 'New Value' } })
        expect(onChange).toHaveBeenCalledWith('New Value')

        expect(textarea).toHaveAccessibleName('Text bearbeiten')
        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
        expect(onCommit).toHaveBeenCalledTimes(1)
        fireEvent.blur(textarea)
        expect(onCommit).toHaveBeenCalledTimes(2)
    })
})
