import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from './WaterSim.ts'

const SPONGE_ROWS = 12
const SPONGE_STRENGTH = 4.0
const DIRTY_EPSILON = 1e-4

export class Sponge {
  private readonly dirty: Uint8Array
  private readonly width: number

  constructor(width: number, depth: number) {
    this.width = width
    this.dirty = new Uint8Array(width * depth)
  }

  step(grid: Grid, waterSim: WaterSim, dt: number, seaSurface: number): Uint8Array {
    const D = grid.depth
    const W = grid.width
    this.dirty.fill(0)

    for (let row = 0; row < SPONGE_ROWS; row++) {
      const z = D - SPONGE_ROWS + row
      if (z < 0) continue
      // Ramp in quadratically, so the sponge's own leading edge does not present
      // a discontinuity for waves to reflect off.
      const t = (row + 1) / SPONGE_ROWS
      const k = Math.min(1, t * t * SPONGE_STRENGTH * dt)

      for (let x = 0; x < W; x++) {
        // Damping the flux alone only takes the wave's momentum; its surface
        // anomaly still carries the energy back out. Relax both toward rest.
        const bed = grid.getSurfaceHeight(x, z) ?? 0
        const target = Math.max(0, seaSurface - bed)
        const w = grid.getWaterHeight(x, z) ?? 0
        const relaxed = w + (target - w) * k
        grid.setWaterHeight(x, z, relaxed)

        waterSim.setFlowX(x, z, waterSim.getFlowX(x, z) * (1 - k))
        waterSim.setFlowZ(x, z, waterSim.getFlowZ(x, z) * (1 - k))

        if (Math.abs(relaxed - w) > DIRTY_EPSILON) {
          this.dirty[z * this.width + x] = 1
        }
      }
    }

    return this.dirty
  }
}
