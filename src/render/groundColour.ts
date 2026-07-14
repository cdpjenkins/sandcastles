import { Color } from 'three'

const OPACITY_DEPTH = 0.5

export function groundColour(sandCol: Color, rockCol: Color, sandDepth: number): Color {
  const ratio = Math.max(0, Math.min(1, sandDepth / OPACITY_DEPTH))
  const t = Math.sqrt(ratio)
  return new Color().lerpColors(rockCol, sandCol, t)
}
