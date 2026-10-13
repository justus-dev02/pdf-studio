import { describe, expect, it } from 'vitest'
import { createPdf, readFixture } from '../../test/pdfFixtures'
import { getPdfDocument, isPdfDocumentCached } from './documentCache'
import { PdfError, isPdfError, normalizePdfJsError } from './errors'
import { hasEncryptDictionary, looksLikePdf } from './inspect'
import { getSource, hasSource } from './sourceRegistry'
import { openPdfSource, releaseAllPdfSources, releasePdfSource } from './sources'

describe('openPdfSource', () => {
    it('registers the bytes and returns metadata from a single parse', async () => {
        const bytes = await createPdf([{}, {}, {}])
        const source = await openPdfSource(bytes, 'three.pdf')

        expect(source).toMatchObject({ name: 'three.pdf', pageCount: 3, sizeBytes: bytes.byteLength, encrypted: false })
        expect(hasSource(source.key)).toBe(true)
        expect(isPdfDocumentCached(source.key)).toBe(true)
    })

    it('shares one parsed document between all callers', async () => {
        const source = await openPdfSource(await createPdf([{}]), 'a.pdf')
        const [a, b] = await Promise.all([getPdfDocument(source.key), getPdfDocument(source.key)])
        expect(a).toBe(b)
    })

    it('rejects files without a PDF header before invoking pdf.js', async () => {
        const error = await openPdfSource(new TextEncoder().encode('hello'), 'fake.pdf').catch((e: unknown) => e)
        expect(isPdfError(error, 'invalid-pdf')).toBe(true)
    })

    it('rejects damaged files and does not leak the registered source', async () => {
        const broken = new TextEncoder().encode('%PDF-1.7\nthis is not a pdf body')
        const error = await openPdfSource(broken, 'broken.pdf', { key: 'broken-key' }).catch((e: unknown) => e)
        expect(isPdfError(error, 'invalid-pdf')).toBe(true)
        expect(hasSource('broken-key')).toBe(false)
    })

    it('asks for a password and reports wrong passwords for encrypted files', async () => {
        const bytes = readFixture('encrypted.pdf')
        const missing = await openPdfSource(bytes, 'enc.pdf').catch((e: unknown) => e)
        expect(isPdfError(missing, 'password-required')).toBe(true)

        const wrong = await openPdfSource(bytes, 'enc.pdf', { password: 'nope' }).catch((e: unknown) => e)
        expect(isPdfError(wrong, 'password-incorrect')).toBe(true)

        const source = await openPdfSource(bytes, 'enc.pdf', { password: 'secret' })
        expect(source.pageCount).toBe(3)
        expect(source.encrypted).toBe(true)
        expect(getSource(source.key).password).toBe('secret')
    })

    it('releases a single source and all of its caches', async () => {
        const source = await openPdfSource(await createPdf([{}]), 'a.pdf')
        await releasePdfSource(source.key)
        expect(hasSource(source.key)).toBe(false)
        expect(isPdfDocumentCached(source.key)).toBe(false)
        expect(() => getSource(source.key)).toThrow(PdfError)
    })

    it('releases every source at once', async () => {
        const a = await openPdfSource(await createPdf([{}]), 'a.pdf')
        const b = await openPdfSource(await createPdf([{}]), 'b.pdf')
        await releaseAllPdfSources()
        expect(hasSource(a.key) || hasSource(b.key)).toBe(false)
    })
})

describe('byte inspection', () => {
    it('detects the PDF header with leading garbage', () => {
        expect(looksLikePdf(new TextEncoder().encode('junk\n%PDF-1.4'))).toBe(true)
        expect(looksLikePdf(new TextEncoder().encode('PK\u0003\u0004'))).toBe(false)
    })

    it('finds the /Encrypt reference near the start or end of a file', async () => {
        expect(hasEncryptDictionary(readFixture('encrypted.pdf'))).toBe(true)
        expect(hasEncryptDictionary(await createPdf([{}]))).toBe(false)
    })
})

describe('normalizePdfJsError', () => {
    it('maps pdf.js exceptions to typed codes', () => {
        expect(normalizePdfJsError({ name: 'PasswordException', code: 1 }).code).toBe('password-required')
        expect(normalizePdfJsError({ name: 'PasswordException', code: 2 }).code).toBe('password-incorrect')
        expect(normalizePdfJsError({ name: 'RenderingCancelledException' }).code).toBe('cancelled')
        expect(normalizePdfJsError(new Error('boom')).code).toBe('invalid-pdf')
        const original = new PdfError('source-missing')
        expect(normalizePdfJsError(original)).toBe(original)
    })
})
