import type { Grid } from '../core/Grid.ts'

const ANGLE_OF_REPOSE_DEGREES = 32
const TAN_AOR = Math.tan((ANGLE_OF_REPOSE_DEGREES * Math.PI) / 180)
// How much of the excess over the repose angle slumps away per second. A rate,
// not a fraction per step: as a per-step fraction the slumping ran at whatever
// SIM_HZ happened to be, and at 30 Hz a fraction of 0.5 comes to 15/s, which
// projects any bank straight onto the repose slope inside a single step.
//
// 1/s against that 15/s deepens the stream's channel by a fifth and narrows it
// by a tenth (at z=80 of the beach scene, 2.97 deep over 84 cells becomes 3.59
// over 77), and settles a spade-high wall in about a second rather than
// instantly. Slower buys no more shape -- 0.5/s measures the same channel and
// only feels sluggish -- because what widens the river is that the banks slump
// into it at all, not how fast. See CLAUDE.md.
const SLUMP_RATE = 1.0
// Moving sand between a pair of cells closes their height difference by twice
// what moves, so a fraction past a half steps over the repose slope and lands
// steeper the other way -- and the next step throws it back harder. Whatever dt
// arrives, never take more than the fraction that lands on the slope itself.
const MAX_SLUMP_FRACTION = 0.5
const DIRTY_EPSILON = 1e-4

export class Slope {
  private readonly dirty: Uint8Array
  private readonly width: number

  constructor(width: number, depth: number) {
    this.width = width
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid, dt: number): Uint8Array {
    const W = grid.width
    const D = grid.depth
    const fraction = Math.min(SLUMP_RATE * dt, MAX_SLUMP_FRACTION)

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
          const transfer = Math.min(excess * fraction, sand)
          if (transfer <= 0) continue

          grid.setSandHeight(x, z, sand - transfer)
          grid.setSandHeight(nx, nz, nSand + transfer)
          if (transfer > DIRTY_EPSILON) {
            this.dirty[z * this.width + x] = 1
            this.dirty[nz * this.width + nx] = 1
          }
        }
      }
    }

    return this.dirty
  }
}
