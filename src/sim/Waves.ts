import type { Grid } from '../core/Grid.ts'

const PERIOD = 20
const SURGE_HEIGHT = 10
const SURGE_ROWS = 4
export const BASE_SEA_LEVEL = 1.0
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

  step(grid: Grid, dt: number, seaZ: number, seaLevel: number): Uint8Array {
    this.fired = false
    this.timeUntilWave -= dt
    this.dirty.fill(0)

    const W = grid.width
    const D = grid.depth

    if (this.timeUntilWave <= 0) {
      this.fired = true
      this.timeUntilWave = PERIOD
      for (let row = 0; row < SURGE_ROWS; row++) {
        const z = seaZ - 1 - row
        if (z < 0) continue
        for (let x = 0; x < W; x++) {
          const w = grid.getWaterHeight(x, z) ?? 0
          grid.setWaterHeight(x, z, w + SURGE_HEIGHT)
          this.dirty[z * this.width + x] = 1
        }
      }
    }

    for (let z = seaZ; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const w = grid.getWaterHeight(x, z) ?? 0
        if (Math.abs(w - seaLevel) > DIRTY_EPSILON) {
          grid.setWaterHeight(x, z, seaLevel)
          this.dirty[z * this.width + x] = 1
        }
      }
    }

    return this.dirty
  }
}
