/**
 * Measures the operations that scale with document size, using the same libraries as the app.
 *   node scripts/benchmark.mjs [pages]
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const PAGES = Number(process.argv[2] ?? 1000)
const time = async (label, fn) => {
    const start = performance.now()
    const result = await fn()
    console.log(`${label.padEnd(42)} ${(performance.now() - start).toFixed(0).padStart(6)} ms`)
    return result
}

const bytes = await time(`create ${PAGES}-page PDF (pdf-lib)`, async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (let i = 0; i < PAGES; i++) {
        const page = doc.addPage([595, 842])
        for (let line = 0; line < 30; line++) page.drawText(`Seite ${i + 1}, Zeile ${line + 1}: Die Frist beträgt drei Monate.`, { x: 50, y: 780 - line * 24, size: 11, font })
    }
    return doc.save()
})
console.log(`file size: ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB`)

const doc = await time('parse once (pdf.js getDocument)', () => getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise)
const texts = await time(`extract text of all ${PAGES} pages`, async () => {
    const out = []
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        out.push((await page.getTextContent()).items.map((it) => it.str).join(' '))
        page.cleanup()
    }
    return out
})
await time('search "Frist" in cached text (JS regex)', () => texts.reduce((n, t) => n + (t.match(/frist/gi)?.length ?? 0), 0))
await time(`old approach: re-parse per page (first 50 pages)`, async () => {
    for (let i = 1; i <= 50; i++) {
        const d = await getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise
        await (await d.getPage(i)).getTextContent()
        await d.destroy()
    }
})
await doc.destroy()
