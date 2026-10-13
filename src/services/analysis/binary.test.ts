import { describe, expect, it } from 'vitest'
import { readFixture } from '../../test/pdfFixtures'
import { analyzePdfBinary, sha256Hex } from './binary'

const encode = (text: string) => new TextEncoder().encode(text)

describe('analyzePdfBinary (parity with Rust engine)', () => {
    it('counts objects without confusing /Page and /Pages', async () => {
        const sample = '%PDF-1.7\n1 0 obj\n<< /Type /Pages /Kids [2 0 R] >>\nendobj\n2 0 obj\n<< /Type/Page /Annots [4 0 R] >>\nendobj\n3 0 obj\n<< /Type /Font >>\nendobj\n4 0 obj\n<< /Type /Annot /Subtype /Link >>\nendobj\ntrailer\n<< /Size 5 >>\n%%EOF'
        const result = await analyzePdfBinary(encode(sample))
        expect(result).toMatchObject({
            pdf_version: '1.7',
            page_objects_count: 1,
            font_objects_count: 1,
            annotation_objects_count: 1,
            is_encrypted: false,
            has_object_streams: false,
            has_embedded_files: false,
        })
    })

    it('computes a real SHA-256 digest', async () => {
        expect(await sha256Hex(encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
        expect((await analyzePdfBinary(encode('abc'))).pdf_version).toBeNull()
    })

    it('detects encryption and object streams', async () => {
        const result = await analyzePdfBinary(encode('%PDF-1.5\n<< /Type /ObjStm >>\ntrailer << /Encrypt 9 0 R >>'))
        expect(result.is_encrypted).toBe(true)
        expect(result.has_object_streams).toBe(true)
        expect((await analyzePdfBinary(readFixture('encrypted.pdf'))).is_encrypted).toBe(true)
    })

    it('counts a match that straddles a chunk boundary exactly once', async () => {
        const chunk = 8 * 1024 * 1024
        const bytes = new Uint8Array(chunk + 64).fill(0x20)
        const marker = encode('/Type /Page ')
        bytes.set(marker, chunk - 5)
        expect((await analyzePdfBinary(bytes)).page_objects_count).toBe(1)
    })
})
