import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from './WaterSim.ts'

const EROSION_K = 0.5
const DEPOSITION_K = 0.3
const MIN_WATER_TO_ERODE = 1e-5

export class Erosion {
  step(grid: Grid, waterSim: WaterSim, dt: number): void {
    const W = grid.width
    const D = grid.depth

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const water = grid.getWaterHeight(x, z) ?? 0
        if (water < MIN_WATER_TO_ERODE) continue

        const velocity = waterSim.getVelocity(x, z)
        const capacity = velocity * EROSION_K
        const sediment = grid.getSediment(x, z) ?? 0
        const sand = grid.getSandHeight(x, z) ?? 0

        if (sediment < capacity && sand > 0) {
          const erode = Math.min((capacity - sediment) * dt, sand)
          grid.setSandHeight(x, z, sand - erode)
          grid.setSediment(x, z, sediment + erode)
        } else if (sediment > capacity) {
          const deposit = Math.min((sediment - capacity) * DEPOSITION_K * dt, sediment)
          grid.setSandHeight(x, z, sand + deposit)
          grid.setSediment(x, z, sediment - deposit)
        }
      }
    }
  }
}
