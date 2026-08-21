import type { Grid } from '../core/Grid.ts'

const FILM_DEPTH = 0.01
const DRY_RATE = 0.02

export class Drying {
  private readonly dirty: Uint8Array
  private readonly width: number

  constructor(width: number, depth: number) {
    this.width = width
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid, dt: number): Uint8Array {
    this.dirty.fill(0)

    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        const w = grid.getWaterHeight(x, z) ?? 0
        if (w > FILM_DEPTH) continue

        const dried = Math.max(0, w - DRY_RATE * dt)
        grid.setWaterHeight(x, z, dried)

        // Any change at all, where the sibling sims use a DIRTY_EPSILON of 1e-4.
        // The step that takes the last of the film to zero is a change of about
        // that size, and it is the one transition that must reach the mesh.
        if (dried !== w) this.dirty[z * this.width + x] = 1
      }
    }
    return this.dirty
  }
}
