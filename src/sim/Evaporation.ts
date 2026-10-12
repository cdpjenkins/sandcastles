import type { Grid } from '../core/Grid.ts'
import { settleSediment } from './settleSediment.ts'

// A zeroth-order sink: evaporation is a surface process and has no idea how
// much water is stacked beneath it, so every wet cell loses the same depth per
// second. Time to dry is therefore h/k, and the volume ratio alone is what
// makes a film vanish while a puddle persists.
const EVAPORATION_RATE = 0.00128

export class Evaporation {
  private readonly dirty: Uint8Array
  private readonly width: number

  constructor(width: number, depth: number) {
    this.width = width
    this.dirty = new Uint8Array(width * depth)
  }

  // seaSurface is the tide-adjusted sea elevation, not a depth. A cell whose
  // own surface sits at or below it is the sea rather than a puddle, and the
  // ocean it belongs to makes good whatever it loses — so it is exempt. That
  // is the replenishment: without it an ungated sink drains the whole beach.
  step(grid: Grid, dt: number, seaSurface: number): Uint8Array {
    this.dirty.fill(0)

    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        const w = grid.getWaterHeight(x, z) ?? 0
        if (w === 0) continue

        const bed = grid.getSurfaceHeight(x, z) ?? 0
        if (bed + w <= seaSurface) continue

        const evaporated = Math.max(0, w - EVAPORATION_RATE * dt)
        grid.setWaterHeight(x, z, evaporated)

        if (evaporated === 0) settleSediment(grid, x, z)

        // Any change at all, where the sibling sims use a DIRTY_EPSILON of 1e-4.
        // The step that takes the last of the water to zero is a change of about
        // that size, and it is the one transition that must reach the mesh.
        if (evaporated !== w) this.dirty[z * this.width + x] = 1
      }
    }
    return this.dirty
  }
}
