import type { Grid } from '../core/Grid.ts'

const PERIOD = 20
const SURGE_HEIGHT = 10
const SURGE_ROWS = 4
const SEA_LEVEL = 1.0

export class Waves {
  readonly period = PERIOD
  readonly seaLevel = SEA_LEVEL
  timeUntilWave = PERIOD

  step(grid: Grid, dt: number, seaZ: number): void {
    this.timeUntilWave -= dt

    if (this.timeUntilWave <= 0) {
      this.timeUntilWave = PERIOD
      const W = grid.width
      for (let row = 0; row < SURGE_ROWS; row++) {
        const z = seaZ - 1 - row
        if (z < 0) continue
        for (let x = 0; x < W; x++) {
          const w = grid.getWaterHeight(x, z) ?? 0
          grid.setWaterHeight(x, z, w + SURGE_HEIGHT)
        }
      }
    }

    const W = grid.width
    const D = grid.depth
    for (let z = seaZ; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const w = grid.getWaterHeight(x, z) ?? 0
        if (w > SEA_LEVEL) grid.setWaterHeight(x, z, SEA_LEVEL)
      }
    }
  }
}
