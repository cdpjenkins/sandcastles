import type { Grid } from '../core/Grid.ts'

const DIFFUSE_RATE = 0.1
const EVAPORATE_RATE = 0.02

export class Moisture {
  step(grid: Grid, dt: number): void {
    const W = grid.width
    const D = grid.depth

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const water = grid.getWaterHeight(x, z) ?? 0
        if (water > 0) {
          grid.setMoisture(x, z, 1.0)
          continue
        }

        const m = grid.getMoisture(x, z) ?? 0

        const n = grid.getMoisture(x, z - 1) ?? 0
        const s = grid.getMoisture(x, z + 1) ?? 0
        const e = grid.getMoisture(x + 1, z) ?? 0
        const w = grid.getMoisture(x - 1, z) ?? 0
        const neighbourAvg = (n + s + e + w) / 4

        const diffused = m + (neighbourAvg - m) * DIFFUSE_RATE * dt
        const evaporated = Math.max(0, diffused - EVAPORATE_RATE * dt)
        grid.setMoisture(x, z, Math.min(1, evaporated))
      }
    }
  }
}
