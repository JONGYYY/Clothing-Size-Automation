import type { Rect } from './types'

/** Otsu's method: find the threshold that best separates two classes. */
function otsuThreshold(histogram: number[], total: number): number {
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i]

  let sumBg = 0
  let weightBg = 0
  let maxVar = -1
  let threshold = 127

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t]
    if (weightBg === 0) continue
    const weightFg = total - weightBg
    if (weightFg === 0) break

    sumBg += t * histogram[t]
    const meanBg = sumBg / weightBg
    const meanFg = (sumAll - sumBg) / weightFg
    const between = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg)
    if (between > maxVar) {
      maxVar = between
      threshold = t
    }
  }
  return threshold
}

export interface SnapOptions {
  /** 0..100. Higher = include fainter artwork edges (lower threshold). */
  sensitivity?: number
  /** Padding (in image px) added around the detected bounds. Default 0 (exact). */
  padding?: number
}

/** Median value of a 256-bin histogram. */
function histogramMedian(hist: Int32Array, total: number): number {
  const half = total / 2
  let cum = 0
  for (let v = 0; v < 256; v++) {
    cum += hist[v]
    if (cum >= half) return v
  }
  return 127
}

/**
 * Detect the tight bounding box of artwork on a shirt of ANY color inside a
 * region of interest. Works entirely at the image's NATIVE resolution:
 *
 *   1. Estimate the fabric color from the ROI's border ring (the user draws
 *      around the artwork, so the outer frame is mostly shirt). This makes the
 *      detector color-agnostic — a white shirt, black shirt, or colored shirt
 *      all work, because artwork is defined as "whatever deviates from fabric".
 *   2. Build a per-pixel deviation map (max abs channel difference from fabric),
 *      catching artwork that is lighter, darker, OR a different hue.
 *   3. Otsu threshold (sensitivity-shiftable) to a binary artwork mask.
 *   4. Label 8-connected components; drop tiny specks and low-deviation
 *      fabric-only blobs (a component must exceed an area floor AND contain a
 *      strongly-deviating pixel), then take the union of the survivors.
 *   5. Snap fallback: if that union still fills a whole side of the ROI (fabric
 *      such as a collar/seam bridged into the mask), trim that axis to the dense
 *      body of the artwork via a projection profile — so a loosely drawn box
 *      still snaps instead of returning itself.
 *
 * `roi` and the returned rect are in the image's ORIGINAL pixel space.
 * Returns null if no confident artwork is found.
 */
export function detectArtworkBounds(
  image: HTMLImageElement,
  roi: Rect,
  opts: SnapOptions = {},
): Rect | null {
  const { sensitivity = 55, padding = 0 } = opts

  const x0 = Math.max(0, Math.floor(roi.x))
  const y0 = Math.max(0, Math.floor(roi.y))
  const x1 = Math.min(image.naturalWidth, Math.ceil(roi.x + roi.width))
  const y1 = Math.min(image.naturalHeight, Math.ceil(roi.y + roi.height))
  const w = x1 - x0
  const h = y1 - y0
  if (w <= 1 || h <= 1) return null

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  // 1:1 native-resolution draw of the ROI — no resampling.
  ctx.drawImage(image, x0, y0, w, h, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const n = w * h

  // 1) Estimate fabric color from the ROI border ring (mostly shirt). Using the
  //    per-channel median makes it robust to a little artwork touching an edge.
  const margin = Math.max(1, Math.round(Math.min(w, h) * 0.06))
  const rHist = new Int32Array(256)
  const gHist = new Int32Array(256)
  const bHist = new Int32Array(256)
  let borderCount = 0
  for (let y = 0; y < h; y++) {
    const edgeRow = y < margin || y >= h - margin
    for (let x = 0; x < w; x++) {
      if (!edgeRow && x >= margin && x < w - margin) continue
      const i = (y * w + x) * 4
      rHist[data[i]]++
      gHist[data[i + 1]]++
      bHist[data[i + 2]]++
      borderCount++
    }
  }
  const bgR = histogramMedian(rHist, borderCount)
  const bgG = histogramMedian(gHist, borderCount)
  const bgB = histogramMedian(bHist, borderCount)

  // 2) Per-pixel deviation from the fabric color (max abs channel diff), so
  //    lighter, darker, and differently-colored artwork all register.
  const histogram = new Array(256).fill(0)
  const devMap = new Uint8Array(n)
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const dr = Math.abs(data[i] - bgR)
    const dg = Math.abs(data[i + 1] - bgG)
    const db = Math.abs(data[i + 2] - bgB)
    const d = dr > dg ? (dr > db ? dr : db) : dg > db ? dg : db
    devMap[p] = d
    histogram[d]++
  }

  // Otsu threshold; sensitivity 50 -> Otsu, higher -> lower threshold (fainter).
  const base = otsuThreshold(histogram, n)
  const shift = ((50 - sensitivity) / 50) * 30
  const threshold = Math.max(1, Math.min(253, base + shift))

  const mask = new Uint8Array(n)
  let maskCount = 0
  for (let p = 0; p < n; p++) {
    if (devMap[p] > threshold) {
      mask[p] = 1
      maskCount++
    }
  }
  if (maskCount === 0) return null

  // Absolute area floor: drop specks/sparkle but keep small real marks.
  const areaMin = Math.max(6, Math.round(n * 0.00006))
  // A real print element contains a strongly-deviating pixel; low-contrast
  // fabric-only blobs (seams, shadows) are rejected even if large.
  const strongGate = Math.min(254, base + 40)

  // 8-connected component labelling with an explicit stack.
  const labels = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const keptLabels = new Set<number>()
  let label = 0

  for (let start = 0; start < n; start++) {
    if (!mask[start] || labels[start] >= 0) continue
    let sp = 0
    stack[sp++] = start
    labels[start] = label

    let area = 0
    let maxDev = 0

    while (sp > 0) {
      const p = stack[--sp]
      const px = p % w
      const py = (p / w) | 0
      area++
      if (devMap[p] > maxDev) maxDev = devMap[p]

      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = px + dx
          if (nx < 0 || nx >= w) continue
          const np = ny * w + nx
          if (mask[np] && labels[np] < 0) {
            labels[np] = label
            stack[sp++] = np
          }
        }
      }
    }

    if (area >= areaMin && maxDev >= strongGate) keptLabels.add(label)
    label++
  }

  if (keptLabels.size === 0) return null

  // Projection profiles over surviving components.
  const colCount = new Int32Array(w)
  const rowCount = new Int32Array(h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = labels[y * w + x]
      if (l >= 0 && keptLabels.has(l)) {
        colCount[x]++
        rowCount[y]++
      }
    }
  }

  let unionL = -1
  let unionR = -1
  let unionT = -1
  let unionB = -1
  let colPeak = 0
  let rowPeak = 0
  for (let x = 0; x < w; x++) {
    if (colCount[x]) {
      if (unionL < 0) unionL = x
      unionR = x
    }
    if (colCount[x] > colPeak) colPeak = colCount[x]
  }
  for (let y = 0; y < h; y++) {
    if (rowCount[y]) {
      if (unionT < 0) unionT = y
      unionB = y
    }
    if (rowCount[y] > rowPeak) rowPeak = rowCount[y]
  }
  if (unionL < 0 || unionT < 0) return null

  // Trim a projection axis to its dense body (edges below 6% of the peak).
  const trimAxis = (counts: Int32Array, peak: number): [number, number] => {
    const t = Math.max(2, Math.ceil(peak * 0.06))
    let lo = -1
    let hi = -1
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] >= t) {
        if (lo < 0) lo = i
        hi = i
      }
    }
    return lo < 0 ? [0, counts.length - 1] : [lo, hi]
  }

  // Only trim an axis that failed to snap (union spans ~the whole ROI on it),
  // so bright fabric bridged into the mask can't force a full-ROI rectangle.
  let left = unionL
  let right = unionR
  let top = unionT
  let bottom = unionB
  if (unionR - unionL + 1 >= 0.9 * w) [left, right] = trimAxis(colCount, colPeak)
  if (unionB - unionT + 1 >= 0.9 * h) [top, bottom] = trimAxis(rowCount, rowPeak)

  const bx = x0 + Math.max(0, left - padding)
  const by = y0 + Math.max(0, top - padding)
  const bw = Math.min(image.naturalWidth - bx, right - left + 1 + padding * 2)
  const bh = Math.min(image.naturalHeight - by, bottom - top + 1 + padding * 2)

  return { x: bx, y: by, width: bw, height: bh }
}

/** Intersection of two rects, or null if they don't overlap. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}
