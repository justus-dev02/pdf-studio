/**
 * Error codes of the PDF service layer. Services never produce user-facing text;
 * the UI maps codes to localized messages (see i18n `errors`).
 */
export type PdfErrorCode =
    | 'password-required'
    | 'password-incorrect'
    | 'invalid-pdf'
    | 'source-missing'
    | 'page-out-of-range'
    | 'encrypted-export'
    | 'unsupported-image'
    | 'cancelled'

export class PdfError extends Error {
    readonly code: PdfErrorCode

    constructor(code: PdfErrorCode, detail?: string, options?: { cause?: unknown }) {
        super(detail ?? code, options)
        this.name = 'PdfError'
        this.code = code
    }
}

export const isPdfError = (error: unknown, code?: PdfErrorCode): error is PdfError =>
    error instanceof PdfError && (code === undefined || error.code === code)

export const isCancelled = (error: unknown): boolean =>
    isPdfError(error, 'cancelled') || (error instanceof DOMException && error.name === 'AbortError')

/** pdf.js PasswordException codes: 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD. */
const PDFJS_INCORRECT_PASSWORD = 2

/** Maps errors thrown by pdf.js into typed {@link PdfError}s. */
export function normalizePdfJsError(error: unknown): PdfError {
    if (error instanceof PdfError) return error
    const err = error as { name?: string; code?: number; message?: string } | null
    if (err?.name === 'PasswordException') {
        return new PdfError(err.code === PDFJS_INCORRECT_PASSWORD ? 'password-incorrect' : 'password-required', undefined, { cause: error })
    }
    if (err?.name === 'RenderingCancelledException' || err?.name === 'AbortException') {
        return new PdfError('cancelled', undefined, { cause: error })
    }
    return new PdfError('invalid-pdf', err?.message, { cause: error })
}

export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new PdfError('cancelled')
}
