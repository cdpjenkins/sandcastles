import type { Grid } from '../core/Grid.ts'

const ANGLE_OF_REPOSE_DEGREES = 20
const TAN_AOR = Math.tan((ANGLE_OF_REPOSE_DEGREES * Math.PI) / 180)
const TRANSFER_FRACTION = 0.5

export class Slope {
  step(grid: Grid): void {
    const W = grid.width
    const D = grid.depth

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
          if (transfer <= 0) continue

          grid.setSandHeight(x, z, sand - transfer)
          grid.setSandHeight(nx, nz, nSand + transfer)
        }
      }
    }
  }
}
