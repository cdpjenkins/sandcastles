import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from './WaterSim.ts'

const EROSION_K = 2.0
const DEPOSITION_K = 1.2
const MIN_WATER_TO_ERODE = 1e-5
const DIRTY_EPSILON = 1e-4

export class Erosion {
  private readonly dirty: Uint8Array

  constructor(width: number, depth: number) {
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid, waterSim: WaterSim, dt: number): Uint8Array {
    const W = grid.width
    const D = grid.depth

    this.dirty.fill(0)

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const water = grid.getWaterHeight(x, z) ?? 0
        if (water < MIN_WATER_TO_ERODE) continue

        const velocity = waterSim.getVelocity(x, z)
        const capacity = velocity * EROSION_K
        const sediment = grid.getSediment(x, z) ?? 0
        const sand = grid.getSandHeight(x, z) ?? 0

        let newSand = sand
        if (sediment < capacity && sand > 0) {
          const erode = Math.min((capacity - sediment) * dt, sand)
          newSand = sand - erode
          grid.setSandHeight(x, z, newSand)
          grid.setSediment(x, z, sediment + erode)
        } else if (sediment > capacity) {
          const deposit = Math.min((sediment - capacity) * DEPOSITION_K * dt, sediment)
          newSand = sand + deposit
          grid.setSandHeight(x, z, newSand)
          grid.setSediment(x, z, sediment - deposit)
        }

        if (Math.abs(newSand - sand) > DIRTY_EPSILON) {
          this.dirty[z * W + x] = 1
        }
      }
    }

    return this.dirty
  }
}
