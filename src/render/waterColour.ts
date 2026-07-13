import { Color } from 'three'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

const WATER = new Color(MATERIAL_PROPS[Material.Water].colour)
const OPACITY_DEPTH = 0.5

export function waterColour(underlying: Color, depth: number): Color {
  const ratio = Math.max(0, Math.min(1, depth / OPACITY_DEPTH))
  const t = Math.sqrt(ratio)
  return new Color().lerpColors(underlying, WATER, t)
}
