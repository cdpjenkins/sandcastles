import type { Grid } from '../core/Grid.ts'

const PERIOD = 20
const BOUNDARY_ROWS = 1
const DIRTY_EPSILON = 1e-4

export class Waves {
  readonly period = PERIOD
  timeUntilWave = PERIOD
  fired = false

  private readonly dirty: Uint8Array
  private readonly width: number

  constructor(width: number, depth: number) {
    this.width = width
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid, dt: number, seaSurface: number): Uint8Array {
    this.fired = false
    this.timeUntilWave -= dt
    this.dirty.fill(0)

    if (this.timeUntilWave <= 0) {
      this.fired = true
      this.timeUntilWave = PERIOD
    }

    const W = grid.width
    const D = grid.depth

    // Hold only the outermost rows, as an open boundary the sea flows through.
    // Everything inshore of them is simulated, so waves can travel and the tide
    // arrives by filling and draining rather than by fiat.
    for (let z = D - BOUNDARY_ROWS; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const bed = grid.getSurfaceHeight(x, z) ?? 0
        const target = Math.max(0, seaSurface - bed)
        const w = grid.getWaterHeight(x, z) ?? 0
        if (Math.abs(w - target) > DIRTY_EPSILON) {
          grid.setWaterHeight(x, z, target)
          this.dirty[z * this.width + x] = 1
        }
      }
    }

    return this.dirty
  }
}
