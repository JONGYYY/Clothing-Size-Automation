import type { Rect } from './types'

function median(values: number[]): number {
  if (values.length === 0) return 0
  values.sort((a, b) => a - b)
  const mid = values.length >> 1
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

/**
 * Sample the shirt's dominant color in a ring just outside a design's bounding
 * box (the fabric surrounding the artwork). Uses the per-channel median so a few
 * stray highlight pixels don't skew the result. Returns a hex string.
 */
export function sampleMainColor(image: HTMLImageElement, box: Rect, ring = 8): string {
  const W = image.naturalWidth
  const H = image.naturalHeight
  const ex0 = Math.max(0, Math.floor(box.x - ring))
  const ey0 = Math.max(0, Math.floor(box.y - ring))
  const ex1 = Math.min(W, Math.ceil(box.x + box.width + ring))
  const ey1 = Math.min(H, Math.ceil(box.y + box.height + ring))
  const ew = ex1 - ex0
  const eh = ey1 - ey0
  if (ew <= 0 || eh <= 0) return '#000000'

  const canvas = document.createElement('canvas')
  canvas.width = ew
  canvas.height = eh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#000000'
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, ex0, ey0, ew, eh, 0, 0, ew, eh)
  const { data } = ctx.getImageData(0, 0, ew, eh)

  // Inner box (the artwork) in local coords — sample only the surrounding ring.
  const ix0 = box.x - ex0
  const iy0 = box.y - ey0
  const ix1 = ix0 + box.width
  const iy1 = iy0 + box.height

  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  for (let y = 0; y < eh; y++) {
    for (let x = 0; x < ew; x++) {
      const insideArt = x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1
      if (insideArt) continue
      const i = (y * ew + x) * 4
      rs.push(data[i])
      gs.push(data[i + 1])
      bs.push(data[i + 2])
    }
  }
  if (rs.length === 0) return '#000000'
  return `#${toHex(median(rs))}${toHex(median(gs))}${toHex(median(bs))}`
}

/** Crop a design's bounding box from the source image into its own canvas. */
export function cropToCanvas(image: HTMLImageElement, box: Rect): HTMLCanvasElement {
  const w = Math.max(1, Math.round(box.width))
  const h = Math.max(1, Math.round(box.height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, Math.round(box.x), Math.round(box.y), w, h, 0, 0, w, h)
  }
  return canvas
}
