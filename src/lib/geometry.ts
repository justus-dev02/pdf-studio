export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const norm = (x: number, y: number, w: number, h: number) => ({ x: x / w, y: y / h })
export const denorm = (x: number, y: number, w: number, h: number) => ({ x: x * w, y: y * h })
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
