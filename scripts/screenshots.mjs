/**
 * Captures the README screenshots from the production build.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/screenshots.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const out = (name) => fileURLToPath(new URL(`../docs/screenshots/${name}`, import.meta.url))
const fixture = fileURLToPath(new URL('../tests/fixtures/sample.pdf', import.meta.url))
mkdirSync(fileURLToPath(new URL('../docs/screenshots/', import.meta.url)), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto(BASE_URL)
await page.getByTestId('open-pdf-input').setInputFiles(fixture)
await page.getByRole('img', { name: 'Seite 1 von 3' }).waitFor()

// Annotate: highlight + text box
const canvas = page.getByRole('img', { name: 'Seite 1 von 3' })
// Wait until fit-to-width zoom has settled before measuring.
await page.waitForTimeout(500)
const box = await canvas.boundingBox()
const at = (nx, ny) => [box.x + box.width * nx, box.y + box.height * ny]
await page.getByRole('button', { name: 'Hervorheben', exact: true }).click()
await page.mouse.move(...at(0.075, 0.093))
await page.mouse.down()
await page.mouse.move(...at(0.45, 0.13), { steps: 5 })
await page.mouse.up()
await page.getByRole('button', { name: 'Text einfügen' }).click()
await canvas.click({ position: { x: box.width * 0.16, y: box.height * 0.2 } })
await page.getByRole('textbox', { name: 'Text bearbeiten' }).fill('Max Mustermann')
await page.keyboard.press('Control+Enter')
await page.getByRole('button', { name: 'Auswählen', exact: true }).click()

await page.keyboard.press('Control+f')
await page.getByRole('searchbox', { name: 'Im Dokument suchen' }).fill('Frist')
await page.getByText('1 / 2').waitFor()
await page.screenshot({ path: out('editor.png') })

await page.keyboard.press('Escape')
await page.getByRole('button', { name: 'Analyse & KI' }).click()
await page.getByText('Erkannte Aufgaben & Fristen').waitFor()
await page.screenshot({ path: out('analysis.png') })

await browser.close()
console.log('screenshots written to docs/screenshots/')
