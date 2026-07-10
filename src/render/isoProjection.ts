export const ISO_ANGLE_Y = Math.PI / 4
export const ISO_ANGLE_X = Math.atan(1 / Math.sqrt(2))

export interface ScreenDirection {
  readonly right: number
  readonly up: number
}

const cosY = Math.cos(ISO_ANGLE_Y)
const sinY = Math.sin(ISO_ANGLE_Y)
const sinX = Math.sin(ISO_ANGLE_X)

export function worldToScreenDirection(dx: number, dz: number): ScreenDirection {
  return {
    right: dx * cosY - dz * sinY,
    up: -sinX * (dx * sinY + dz * cosY),
  }
}
