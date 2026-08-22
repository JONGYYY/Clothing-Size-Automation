import type { ShirtPreset } from './types'

export const SHIRT_PRESETS: ShirtPreset[] = [
  { label: 'S', widthCm: 46, heightCm: 68 },
  { label: 'M', widthCm: 50, heightCm: 70 },
  { label: 'L', widthCm: 54, heightCm: 74 },
  { label: 'XL', widthCm: 58, heightCm: 76 },
]

/** Distinct, legible colors for design boxes. */
export const BOX_COLORS = [
  '#6ea8fe',
  '#7ee0c0',
  '#f7b955',
  '#f2708a',
  '#b794f6',
  '#63b3ed',
]

export const SHIRT_OUTLINE_COLOR = '#7ee0c0'
export const REF_COLOR = '#f7b955'
