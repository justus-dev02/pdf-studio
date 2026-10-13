/**
 * Cheap byte-level checks that do not require parsing the whole document.
 */

const ENCRYPT_MARKER = '/Encrypt'
/** The trailer (or the xref stream dictionary) that references /Encrypt sits at the start (linearized) or end of a file. */
const SCAN_WINDOW = 64 * 1024

const latin1 = new TextDecoder('latin1')

export function hasEncryptDictionary(bytes: Uint8Array): boolean {
    const head = latin1.decode(bytes.subarray(0, SCAN_WINDOW))
    if (head.includes(ENCRYPT_MARKER)) return true
    const tail = latin1.decode(bytes.subarray(Math.max(0, bytes.length - SCAN_WINDOW)))
    return tail.includes(ENCRYPT_MARKER)
}

export function looksLikePdf(bytes: Uint8Array): boolean {
    // The header may be preceded by up to 1024 bytes of garbage (PDF 32000-1, 7.5.2 implementation note).
    return latin1.decode(bytes.subarray(0, 1024)).includes('%PDF-')
}
