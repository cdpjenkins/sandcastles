import type { Grid } from '../core/Grid.ts'

const ANGLE_OF_REPOSE_DEGREES = 20
const TAN_AOR = Math.tan((ANGLE_OF_REPOSE_DEGREES * Math.PI) / 180)
const TRANSFER_FRACTION = 0.5
const DIRTY_EPSILON = 1e-4

export class Slope {
  private readonly dirty: Uint8Array
  private readonly width: number

  constructor(width: number, depth: number) {
    this.width = width
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid): Uint8Array {
    const W = grid.width
    const D = grid.depth

    this.dirty.fill(0)

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const h = (grid.getRockHeight(x, z) ?? 0) + (grid.getSandHeight(x, z) ?? 0)
        const neighbours: [number, number][] = [
          [x + 1, z],
          [x - 1, z],
          [x, z + 1],
          [x, z - 1],
        ]

        for (const [nx, nz] of neighbours) {
          const nRock = grid.getRockHeight(nx, nz)
          if (nRock === undefined) continue
          const nSand = grid.getSandHeight(nx, nz) ?? 0
          const nh = nRock + nSand

          const excess = h - nh - TAN_AOR
          if (excess <= 0) continue

          const sand = grid.getSandHeight(x, z) ?? 0
          const transfer = Math.min(excess * TRANSFER_FRACTION, sand)
          if (transfer <= DIRTY_EPSILON) continue

          grid.setSandHeight(x, z, sand - transfer)
          grid.setSandHeight(nx, nz, nSand + transfer)
          this.dirty[z * this.width + x] = 1
          this.dirty[nz * this.width + nx] = 1
        }
      }
    }

    return this.dirty
  }
}
