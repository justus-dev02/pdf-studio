/**
 * Generates the PDF fixtures used by unit and E2E tests.
 *
 *   node scripts/create-fixtures.mjs
 *
 * - tests/fixtures/sample.pdf     3 pages: running header/footer, German text, form labels
 * - tests/fixtures/encrypted.pdf  sample.pdf protected with the user password "secret"
 *                                 (requires Ghostscript; skipped with a warning if missing)
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixture = (name) => fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url))

const PAGES = [
    ['Rechnung Nr. 2026-001', 'Bitte zahlen Sie den Betrag bis zum 15. November.', 'Die Frist muss eingehalten werden.', 'Name:', 'Datum:'],
    ['Leistungsübersicht', '- Beratung und Analyse', '- Umsetzung der Änderungen', 'Die Rechnung enthält alle Positionen.'],
    ['Vertragsbedingungen', 'Der Vertrag kann mit einer Frist von drei Monaten gekündigt werden.', 'Unterschrift: ________________'],
]

const doc = await PDFDocument.create()
doc.setTitle('PDF Studio Test Fixture')
const font = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)

PAGES.forEach((lines, index) => {
    const page = doc.addPage([595.28, 841.89])
    page.drawText('Muster GmbH – Kundenportal', { x: 50, y: 800, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    lines.forEach((line, i) => {
        page.drawText(line, { x: 50, y: 740 - i * 28, size: i === 0 ? 18 : 12, font: i === 0 ? bold : font, color: rgb(0.1, 0.1, 0.1) })
    })
    page.drawText(`Seite ${index + 1} von ${PAGES.length}`, { x: 50, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
})

const samplePath = fixture('sample.pdf')
writeFileSync(samplePath, await doc.save({ useObjectStreams: false }))
console.log(`wrote ${samplePath}`)

try {
    execFileSync('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-sDEVICE=pdfwrite', '-sOwnerPassword=owner', '-sUserPassword=secret', `-sOutputFile=${fixture('encrypted.pdf')}`, samplePath])
    console.log(`wrote ${fixture('encrypted.pdf')}`)
} catch {
    console.warn('Ghostscript (gs) not found: tests/fixtures/encrypted.pdf was not regenerated.')
}
