/**
 * Browser implementation of `src-tauri/src/engine/pdf_analyzer.rs`.
 * The file is scanned in chunks so even very large PDFs never become one giant string.
 */
import type { PdfBinaryStructure } from './types'

const CHUNK_SIZE = 8 * 1024 * 1024
/** Longest pattern we look for is well below this; matches starting in the overlap are counted by the next chunk. */
const CHUNK_OVERLAP = 512
const HEADER_WINDOW = 1024

const ANNOTATION_SUBTYPES =
    'Text|Link|FreeText|Line|Square|Circle|Polygon|PolyLine|Highlight|Underline|Squiggly|StrikeOut|Stamp|Caret|Ink|Popup|FileAttachment|Sound|Movie|Widget|Screen|PrinterMark|TrapNet|Watermark|3D|Redact'

const COUNTED = {
    page: /\/Type\s*\/Page(?![A-Za-z0-9_])/g,
    font: /\/Type\s*\/Font(?![A-Za-z0-9_])/g,
    annotation: new RegExp(`/Subtype\\s*/(?:${ANNOTATION_SUBTYPES})(?![A-Za-z0-9_])`, 'g'),
}
const FLAGS = {
    objectStream: /\/Type\s*\/ObjStm(?![A-Za-z0-9_])/,
    encrypt: /\/Encrypt(?![A-Za-z0-9_])/,
    embeddedFiles: /\/EmbeddedFiles(?![A-Za-z0-9_])/,
}

const latin1 = new TextDecoder('latin1')

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function analyzePdfBinary(bytes: Uint8Array): Promise<PdfBinaryStructure> {
    const start = performance.now()
    const counts = { page: 0, font: 0, annotation: 0 }
    const flags = { objectStream: false, encrypt: false, embeddedFiles: false }

    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const ownLength = Math.min(CHUNK_SIZE, bytes.length - offset)
        const chunk = latin1.decode(bytes.subarray(offset, Math.min(bytes.length, offset + ownLength + CHUNK_OVERLAP)))
        for (const key of Object.keys(COUNTED) as (keyof typeof COUNTED)[]) {
            for (const match of chunk.matchAll(COUNTED[key])) {
                if ((match.index ?? 0) < ownLength) counts[key]++
            }
        }
        for (const key of Object.keys(FLAGS) as (keyof typeof FLAGS)[]) {
            flags[key] ||= FLAGS[key].test(chunk)
        }
    }

    const header = /%PDF-(\d\.\d)/.exec(latin1.decode(bytes.subarray(0, HEADER_WINDOW)))

    return {
        file_size_bytes: bytes.length,
        sha256_hash: await sha256Hex(bytes),
        pdf_version: header ? header[1] : null,
        page_objects_count: counts.page,
        font_objects_count: counts.font,
        annotation_objects_count: counts.annotation,
        has_object_streams: flags.objectStream,
        is_encrypted: flags.encrypt,
        has_embedded_files: flags.embeddedFiles,
        analysis_time_ms: Math.round(performance.now() - start),
    }
}
