import type { DesignBox, DesignMeasurement, Rect, ShirtRef } from './types'

/**
 * Uniform, width-anchored scale in pixels-per-cm.
 *
 * The shirt reference width (in original image pixels) is mapped to the real
 * shirt width in cm. This single scale is applied to BOTH axes, matching the
 * "width is the starting point" workflow:
 *   1000px wide shirt with a 50cm real width  -> 20 px/cm
 *   a 70cm real height then spans 1400px.
 */
export function pxPerCm(shirtRef: ShirtRef | null, realWidthCm: number): number | null {
  if (!shirtRef || shirtRef.width <= 0 || realWidthCm <= 0) return null
  return shirtRef.width / realWidthCm
}

/**
 * The real-shirt outline rectangle drawn over the image: same width as the
 * reference, height derived from the real height using the uniform scale, and
 * anchored at the reference's top edge (collar top).
 */
export function realShirtOutline(
  shirtRef: ShirtRef | null,
  realWidthCm: number,
  realHeightCm: number,
): Rect | null {
  const scale = pxPerCm(shirtRef, realWidthCm)
  if (!shirtRef || scale == null || realHeightCm <= 0) return null
  return {
    x: shirtRef.x,
    y: shirtRef.y,
    width: shirtRef.width,
    height: realHeightCm * scale,
  }
}

/** Convert a design box (in image pixels) to real-world cm using the scale. */
export function measureBox(
  box: DesignBox,
  scale: number | null,
): DesignMeasurement {
  const widthCm = scale ? box.width / scale : NaN
  const heightCm = scale ? box.height / scale : NaN
  return {
    id: box.id,
    name: box.name,
    widthPx: box.width,
    heightPx: box.height,
    widthCm,
    heightCm,
  }
}

export function measureAll(
  boxes: DesignBox[],
  shirtRef: ShirtRef | null,
  realWidthCm: number,
): DesignMeasurement[] {
  const scale = pxPerCm(shirtRef, realWidthCm)
  return boxes.map((b) => measureBox(b, scale))
}

/** Nearest integer print size (manufacturer prints whole cm only). */
export function toPrintInteger(cm: number): number {
  return Math.round(cm)
}

/** Golden ratio (short : long). */
export const GOLDEN = 0.618

/**
 * Target print size when fitting a design to the golden ratio of the shirt.
 * One dimension is set to `GOLDEN * shirt dimension`; the other follows the
 * design's own aspect ratio so the artwork is never distorted.
 */
export function goldenTarget(
  anchor: 'width' | 'height',
  shirtWidthCm: number,
  shirtHeightCm: number,
  artWidthCm: number,
  artHeightCm: number,
): { widthCm: number; heightCm: number } {
  const aspect = artWidthCm > 0 ? artHeightCm / artWidthCm : 1 // height per width
  if (anchor === 'width') {
    const widthCm = shirtWidthCm * GOLDEN
    return { widthCm, heightCm: widthCm * aspect }
  }
  const heightCm = shirtHeightCm * GOLDEN
  return { widthCm: aspect > 0 ? heightCm / aspect : heightCm, heightCm }
}

/** The size that will actually be printed: the print frame if set, else measured. */
export function effectivePrintSize(
  measured: { widthCm: number; heightCm: number },
  print?: { widthCm: number; heightCm: number } | null,
): { widthCm: number; heightCm: number } {
  return print ? { widthCm: print.widthCm, heightCm: print.heightCm } : measured
}
