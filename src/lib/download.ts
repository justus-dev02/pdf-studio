/** Triggers a browser download for in-memory data. */
export function downloadBlob(data: Blob, fileName: string): void {
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function withSuffix(fileName: string, suffix: string, extension: string): string {
    const base = fileName.replace(/\.[^.]+$/, '') || 'document'
    return `${base}${suffix}.${extension}`
}
