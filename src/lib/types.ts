/**
 * A rectangle expressed in the ORIGINAL (natural) pixel coordinate space of the
 * uploaded image. All measurement math happens in this space so that on-screen
 * zoom / fit-scaling never affects the computed real-world sizes.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The shirt-width reference. Its WIDTH maps to the real shirt width in cm and
 * defines the single (uniform) px-per-cm scale used for every design. Its top
 * edge is the collar-top anchor from which the real-shirt outline height is
 * drawn.
 */
export interface ShirtRef extends Rect {}

/**
 * Golden-ratio / composition spec for exporting a print-ready image. The frame
 * is the final print rectangle (cm); the artwork is placed inside it and any
 * empty margin is filled with `fillColor` so there is no white space.
 */
export interface PrintSpec {
  widthCm: number
  heightCm: number
  /** Artwork scale relative to a contain-fit inside the frame (1 = fills). */
  artScale: number
  /** Artwork center offset from the frame center, in cm. */
  offsetXCm: number
  offsetYCm: number
  fillColor: string
  goldenAnchor: 'width' | 'height'
}

export interface DesignBox extends Rect {
  id: string
  name: string
  color: string
  print?: PrintSpec
}

/** A design's computed measurements, derived from a box + the active scale. */
export interface DesignMeasurement {
  id: string
  name: string
  widthPx: number
  heightPx: number
  widthCm: number
  heightCm: number
}

/** Full editor document that gets persisted. */
export interface DesignRecord {
  id: string
  name: string
  imageDataUrl: string
  imageWidth: number
  imageHeight: number
  realWidthCm: number
  realHeightCm: number
  shirtRef: ShirtRef | null
  boxes: DesignBox[]
  createdAt: number
  updatedAt: number
}

export interface ShirtPreset {
  label: string
  widthCm: number
  heightCm: number
}
