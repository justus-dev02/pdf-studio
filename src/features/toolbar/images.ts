const EMBEDDABLE = new Set(['image/png', 'image/jpeg'])
/** Larger images are downscaled: a stamp never needs more, and data URLs live in the undo history. */
const MAX_STAMP_SIDE = 1600

const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })

/**
 * Reads an image for use as a stamp. PDF export can only embed PNG and JPEG,
 * so other formats (WebP, GIF) and oversized images are re-encoded as PNG via a canvas.
 */
export async function readImageAsDataUrl(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error(`Unsupported file type: ${file.type}`)
    const bitmap = await createImageBitmap(file)
    try {
        const scale = Math.min(1, MAX_STAMP_SIDE / Math.max(bitmap.width, bitmap.height))
        if (EMBEDDABLE.has(file.type) && scale === 1) return await readAsDataUrl(file)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/png')
    } finally {
        bitmap.close()
    }
}
