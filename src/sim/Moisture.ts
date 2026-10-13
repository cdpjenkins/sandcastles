import type { Grid } from '../core/Grid.ts'
import { settleSediment } from './settleSediment.ts'

// Moisture is water held in the sand, as a fraction of what the cell can
// hold: taking it from bone dry to saturated costs its capacity in water from
// the column above, and damp sand costs only what it is short of. What dries
// out of the sand afterwards is not returned.
//
// Capacity follows the sand, but only its top WET_DEPTH soaks up water in the
// time a game covers, so sand at least that deep holds SATURATION_DEPTH,
// thinner sand pro rata, and bare rock nothing.
export const SATURATION_DEPTH = 0.01
export const WET_DEPTH = 1
// Moisture once `added` dry sand is laid over `sand` at moisture `m`. Only
// the top WET_DEPTH holds moisture, so the new layer is the dry sand plus
// whatever of the old damp sand is still within WET_DEPTH of the surface.
// Damp sand pushed below that is buried, and like absorbed water never
// returned.
export const moistureAfterDrySand = (m: number, sand: number, added: number): number => {
  const layer = Math.min(sand + added, WET_DEPTH)
  if (layer === 0) return m
  const dampStillInLayer = Math.min(sand, Math.max(0, WET_DEPTH - added))
  return (m * dampStillInLayer) / layer
}

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
          const sand = grid.getSandHeight(x, z) ?? 0
          const capacity = SATURATION_DEPTH * Math.min(sand / WET_DEPTH, 1)
          // Rock holds nothing, but wet rock still looks wet.
          if (capacity === 0) {
            if (m !== 1) {
              grid.setMoisture(x, z, 1)
              this.dirty[i] = 1
            }
            continue
          }
          const absorbed = Math.min(water, (1 - m) * capacity)
          if (absorbed > 0) {
            const remaining = water - absorbed
            grid.setWaterHeight(x, z, remaining)
            grid.setMoisture(x, z, m + absorbed / capacity)
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
