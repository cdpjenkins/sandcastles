import type { Grid } from '../core/Grid.ts'

const GRAVITY = 9.8
const DAMPING = 0.99
const MAX_FLOW = 4.0
const DIRTY_EPSILON = 1e-4

export class WaterSim {
  private readonly flowX: Float32Array
  private readonly flowZ: Float32Array
  private readonly dirty: Uint8Array
  private readonly width: number
  private readonly depth: number

  constructor(width: number, depth: number) {
    this.width = width
    this.depth = depth
    this.flowX = new Float32Array(width * depth)
    this.flowZ = new Float32Array(width * depth)
    this.dirty = new Uint8Array(width * depth)
  }

  reset(): void {
    this.flowX.fill(0)
    this.flowZ.fill(0)
  }

  step(grid: Grid, dt: number): Uint8Array {
    const W = this.width
    const D = this.depth

    // Update pipe flow rates based on total height difference
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        const hi = (grid.getSurfaceHeight(x, z) ?? 0) + (grid.getWaterHeight(x, z) ?? 0)

        if (x + 1 < W) {
          const hj = (grid.getSurfaceHeight(x + 1, z) ?? 0) + (grid.getWaterHeight(x + 1, z) ?? 0)
          this.flowX[i] = Math.max(-MAX_FLOW, Math.min(MAX_FLOW,
            (this.flowX[i] + GRAVITY * (hi - hj) * dt) * DAMPING
          ))
        }

        if (z + 1 < D) {
          const hj = (grid.getSurfaceHeight(x, z + 1) ?? 0) + (grid.getWaterHeight(x, z + 1) ?? 0)
          this.flowZ[i] = Math.max(-MAX_FLOW, Math.min(MAX_FLOW,
            (this.flowZ[i] + GRAVITY * (hi - hj) * dt) * DAMPING
          ))
        }
      }
    }

    // Scale outflows to prevent negative water
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        const w = grid.getWaterHeight(x, z) ?? 0

        let outflow = 0
        if (x + 1 < W && this.flowX[i] > 0) outflow += this.flowX[i]
        if (x > 0 && this.flowX[(z * W + x - 1)] < 0) outflow -= this.flowX[z * W + x - 1]
        if (z + 1 < D && this.flowZ[i] > 0) outflow += this.flowZ[i]
        if (z > 0 && this.flowZ[((z - 1) * W + x)] < 0) outflow -= this.flowZ[(z - 1) * W + x]

        const maxOut = w / dt
        if (outflow > maxOut && outflow > 0) {
          const scale = maxOut / outflow
          if (x + 1 < W && this.flowX[i] > 0) this.flowX[i] *= scale
          if (x > 0 && this.flowX[z * W + x - 1] < 0) this.flowX[z * W + x - 1] *= scale
          if (z + 1 < D && this.flowZ[i] > 0) this.flowZ[i] *= scale
          if (z > 0 && this.flowZ[(z - 1) * W + x] < 0) this.flowZ[(z - 1) * W + x] *= scale
        }
      }
    }

    // Apply flows, inject sources, record dirty cells
    this.dirty.fill(0)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        let delta = 0

        if (x + 1 < W) delta -= this.flowX[i]
        if (x > 0) delta += this.flowX[z * W + x - 1]
        if (z + 1 < D) delta -= this.flowZ[i]
        if (z > 0) delta += this.flowZ[(z - 1) * W + x]

        const source = grid.getSourceRate(x, z) ?? 0
        const wBefore = grid.getWaterHeight(x, z) ?? 0
        const wAfter = Math.max(0, wBefore + delta * dt + source * dt)
        grid.setWaterHeight(x, z, wAfter)

        if (Math.abs(wAfter - wBefore) > DIRTY_EPSILON) {
          this.dirty[i] = 1
        }
      }
    }

    return this.dirty
  }
}
