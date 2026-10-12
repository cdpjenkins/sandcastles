import type { Grid } from '../core/Grid.ts'
import { settleSediment } from './settleSediment.ts'

// Moisture is water held in the sand: taking a cell from bone dry to
// saturated costs this depth of the water above it, and damp sand costs only
// what it is short of. What dries out of the sand afterwards is not returned.
export const SATURATION_DEPTH = 0.01
const DIFFUSE_RATE = 0.1
const EVAPORATE_RATE = 0.02
const DIRTY_EPSILON = 1e-4

export class Moisture {
  private readonly dirty: Uint8Array

  constructor(width: number, depth: number) {
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid, dt: number): Uint8Array {
    const W = grid.width
    const D = grid.depth

    this.dirty.fill(0)

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        const water = grid.getWaterHeight(x, z) ?? 0
        const m = grid.getMoisture(x, z) ?? 0

        if (water > 0) {
          const absorbed = Math.min(water, (1 - m) * SATURATION_DEPTH)
          if (absorbed > 0) {
            const remaining = water - absorbed
            grid.setWaterHeight(x, z, remaining)
            grid.setMoisture(x, z, m + absorbed / SATURATION_DEPTH)
            // A film soaked up whole leaves a dry cell, and a change of this
            // size is the one transition that must reach the mesh.
            if (remaining === 0) settleSediment(grid, x, z)
            this.dirty[i] = 1
          }
          continue
        }

        const n = grid.getMoisture(x, z - 1) ?? 0
        const s = grid.getMoisture(x, z + 1) ?? 0
        const e = grid.getMoisture(x + 1, z) ?? 0
        const w = grid.getMoisture(x - 1, z) ?? 0
        const neighbourAvg = (n + s + e + w) / 4

        const diffused = m + (neighbourAvg - m) * DIFFUSE_RATE * dt
        const evaporated = Math.max(0, diffused - EVAPORATE_RATE * dt)
        const newMoisture = Math.min(1, evaporated)
        grid.setMoisture(x, z, newMoisture)
        if (Math.abs(newMoisture - m) > DIRTY_EPSILON) this.dirty[i] = 1
      }
    }

    return this.dirty
  }
}
