import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const fixture = (name: string) => join(process.cwd(), 'tests/fixtures', name)

async function openSample(page: Page, name = 'sample.pdf') {
    await page.goto('/')
    await page.getByTestId('open-pdf-input').setInputFiles(fixture(name))
    if (name !== 'encrypted.pdf') await expect(page.getByRole('img', { name: /^Seite 1 von/ })).toBeVisible()
}

async function pdfText(bytes: Uint8Array): Promise<string[]> {
    const doc = await getDocument({ data: bytes, isEvalSupported: false }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
        const content = await (await doc.getPage(i)).getTextContent()
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return pages
}

test.describe('PDF Studio', () => {
    test('opens a PDF, annotates it and exports a valid file containing the annotations', async ({ page }) => {
        await openSample(page)
        const sidebar = page.getByRole('navigation', { name: 'Seitenübersicht' })
        await expect(sidebar.getByRole('listitem')).toHaveCount(3)
        await expect(page.getByRole('img', { name: 'Seite 1 von 3' })).toBeVisible()

        // Highlight
        await page.getByRole('button', { name: 'Hervorheben', exact: true }).click()
        const canvas = page.getByRole('img', { name: 'Seite 1 von 3' })
        const box = await canvas.boundingBox()
        if (!box) throw new Error('canvas not visible')
        await page.mouse.move(box.x + 60, box.y + 60)
        await page.mouse.down()
        await page.mouse.move(box.x + 220, box.y + 120, { steps: 5 })
        await page.mouse.up()

        // Text box
        await page.getByRole('button', { name: 'Text einfügen' }).click()
        await canvas.click({ position: { x: 80, y: 200 } })
        await page.getByRole('textbox', { name: 'Text bearbeiten' }).fill('E2E Vermerk')
        await page.keyboard.press('Control+Enter')

        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('button', { name: 'PDF exportieren (Strg+S)' }).click()
        const download = await downloadPromise
        expect(download.suggestedFilename()).toBe('sample-edited.pdf')

        const bytes = new Uint8Array(await readFile(await download.path()))
        const exported = await PDFDocument.load(bytes)
        expect(exported.getPageCount()).toBe(3)
        const text = await pdfText(bytes)
        expect(text[0]).toContain('E2E Vermerk')
        expect(text[0]).toContain('Rechnung Nr. 2026-001')
        await expect(page.getByRole('status').filter({ hasText: 'PDF exportiert.' })).toBeVisible()
    })

    test('reorders and deletes pages with undo and redo', async ({ page }) => {
        await openSample(page)
        const sidebar = page.getByRole('navigation', { name: 'Seitenübersicht' })
        await sidebar.getByRole('button', { name: 'Seite 1 nach unten verschieben' }).click()
        await sidebar.getByRole('button', { name: 'Seite 3 löschen' }).click()
        await expect(sidebar.getByRole('listitem')).toHaveCount(2)

        await page.keyboard.press('Control+z')
        await expect(sidebar.getByRole('listitem')).toHaveCount(3)
        await page.getByRole('button', { name: 'Wiederholen (Strg+Umschalt+Z)' }).click()
        await expect(sidebar.getByRole('listitem')).toHaveCount(2)

        const downloadPromise = page.waitForEvent('download')
        await page.keyboard.press('Control+s')
        const text = await pdfText(new Uint8Array(await readFile(await (await downloadPromise).path())))
        expect(text).toHaveLength(2)
        expect(text[0]).toContain('Leistungsübersicht')
        expect(text[1]).toContain('Rechnung Nr. 2026-001')
    })

    test('unlocks password-protected PDFs and refuses to export them', async ({ page }) => {
        await openSample(page, 'encrypted.pdf')
        const dialog = page.getByRole('dialog', { name: 'Passwortgeschütztes PDF' })
        await dialog.getByLabel('Passwort').fill('wrong')
        await dialog.getByRole('button', { name: 'Entsperren' }).click()
        await expect(dialog).toContainText('Das Passwort ist falsch')
        await dialog.getByLabel('Passwort').fill('secret')
        await dialog.getByRole('button', { name: 'Entsperren' }).click()
        await expect(page.getByRole('img', { name: 'Seite 1 von 3' })).toBeVisible()

        await page.getByRole('button', { name: 'PDF exportieren (Strg+S)' }).click()
        await expect(page.getByRole('alert')).toContainText('Verschlüsselte PDFs können nicht exportiert werden')
    })

    test('searches the document and highlights matches', async ({ page }) => {
        await openSample(page)
        await page.keyboard.press('Control+f')
        await page.getByRole('searchbox', { name: 'Im Dokument suchen' }).fill('Frist')
        await expect(page.getByText('1 / 2')).toBeVisible()
        await expect(page.locator('rect[data-current]')).toHaveCount(1)
        await page.keyboard.press('Enter')
        await expect(page.getByRole('img', { name: 'Seite 3 von 3' })).toBeVisible()
    })

    test('restores the last session after a reload', async ({ page }) => {
        await openSample(page)
        await page.getByRole('button', { name: 'Leere A4-Seite anhängen' }).click()
        await expect(page.getByRole('navigation', { name: 'Seitenübersicht' }).getByRole('listitem')).toHaveCount(4)
        // Autosave is debounced by 1.5 s.
        await page.waitForTimeout(2000)
        page.on('dialog', (dialog) => dialog.accept())
        await page.reload()
        await page.getByRole('button', { name: 'Wiederherstellen' }).click()
        await expect(page.getByRole('navigation', { name: 'Seitenübersicht' }).getByRole('listitem')).toHaveCount(4)
    })

    test('has no detectable accessibility violations', async ({ page }) => {
        await openSample(page)
        await expect(page.getByRole('img', { name: 'Seite 1 von 3' })).toBeVisible()
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])

        await page.getByRole('button', { name: 'Analyse & KI' }).click()
        await expect(page.getByRole('dialog', { name: 'Analyse & KI' })).toBeVisible()
        const dialogResults = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()
        expect(dialogResults.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1] ?? ''}`))).toEqual([])
    })
})
