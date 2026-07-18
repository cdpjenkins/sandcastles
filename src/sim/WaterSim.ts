import type { Grid } from '../core/Grid.ts'

const GRAVITY = 9.8
const MANNING_N = 0.03
const MAX_VELOCITY = 8.0
const DRY_DEPTH = 1e-6
const DIRTY_EPSILON = 1e-4

// Manning bed friction, solved semi-implicitly for the new flux rather than
// subtracting a term built from the old one. That form is stable at any depth and
// can never flip the flux's sign, which an explicit term does once h gets small.
const withDrag = (q: number, depth: number, dt: number): number => {
  if (depth <= DRY_DEPTH) return 0
  const h73 = depth * depth * Math.cbrt(depth)
  return q / (1 + (GRAVITY * MANNING_N * MANNING_N * Math.abs(q) * dt) / h73)
}

export class WaterSim {
  private readonly flowX: Float32Array
  private readonly flowZ: Float32Array
  private readonly dirty: Uint8Array
  private readonly velocityArr: Float32Array
  private readonly width: number
  private readonly depth: number

  constructor(width: number, depth: number) {
    this.width = width
    this.depth = depth
    this.flowX = new Float32Array(width * depth)
    this.flowZ = new Float32Array(width * depth)
    this.dirty = new Uint8Array(width * depth)
    this.velocityArr = new Float32Array(width * depth)
  }

  getVelocity(x: number, z: number): number {
    return this.velocityArr[z * this.width + x] ?? 0
  }

  getFlowX(x: number, z: number): number {
    return this.flowX[z * this.width + x] ?? 0
  }

  getFlowZ(x: number, z: number): number {
    return this.flowZ[z * this.width + x] ?? 0
  }

  setFlowX(x: number, z: number, v: number): void {
    this.flowX[z * this.width + x] = v
  }

  setFlowZ(x: number, z: number, v: number): void {
    this.flowZ[z * this.width + x] = v
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
        const wi = grid.getWaterHeight(x, z) ?? 0
        const hi = (grid.getSurfaceHeight(x, z) ?? 0) + wi

        if (x + 1 < W) {
          const wj = grid.getWaterHeight(x + 1, z) ?? 0
          const hj = (grid.getSurfaceHeight(x + 1, z) ?? 0) + wj
          // Average z-velocity at the four corners surrounding this x-edge
          const vNW = z > 0     ? this.flowZ[(z - 1) * W + x]     : 0
          const vNE = z > 0     ? this.flowZ[(z - 1) * W + x + 1] : 0
          const vSW = z + 1 < D ? this.flowZ[i]                   : 0
          const vSE = z + 1 < D ? this.flowZ[z * W + x + 1]       : 0
          const vAvg = (vNW + vNE + vSW + vSE) / 4
          // Upwind z-gradient of x-flow
          const uHere = this.flowX[i]
          const uUp   = z > 0     ? this.flowX[(z - 1) * W + x] : uHere
          const uDown = z + 1 < D ? this.flowX[(z + 1) * W + x] : uHere
          const duDz  = vAvg >= 0 ? uHere - uUp : uDown - uHere
          const edgeDepth = (wi + wj) / 2
          const maxFlux = MAX_VELOCITY * edgeDepth
          this.flowX[i] = Math.max(-maxFlux, Math.min(maxFlux, withDrag(
            this.flowX[i] + GRAVITY * edgeDepth * (hi - hj) * dt - vAvg * duDz * dt,
            edgeDepth, dt,
          )))
        }

        if (z + 1 < D) {
          const wj = grid.getWaterHeight(x, z + 1) ?? 0
          const hj = (grid.getSurfaceHeight(x, z + 1) ?? 0) + wj
          // Average x-velocity at the four corners surrounding this z-edge
          const uNW = x > 0     ? this.flowX[z * W + x - 1]       : 0
          const uNE = x + 1 < W ? this.flowX[i]                   : 0
          const uSW = x > 0     ? this.flowX[(z + 1) * W + x - 1] : 0
          const uSE = x + 1 < W ? this.flowX[(z + 1) * W + x]     : 0
          const uAvg = (uNW + uNE + uSW + uSE) / 4
          // Upwind x-gradient of z-flow
          const vHere  = this.flowZ[i]
          const vLeft  = x > 0     ? this.flowZ[z * W + x - 1] : vHere
          const vRight = x + 1 < W ? this.flowZ[z * W + x + 1] : vHere
          const dvDx   = uAvg >= 0 ? vHere - vLeft : vRight - vHere
          const edgeDepth = (wi + wj) / 2
          const maxFlux = MAX_VELOCITY * edgeDepth
          this.flowZ[i] = Math.max(-maxFlux, Math.min(maxFlux, withDrag(
            this.flowZ[i] + GRAVITY * edgeDepth * (hi - hj) * dt - uAvg * dvDx * dt,
            edgeDepth, dt,
          )))
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

    // Apply flows, inject sources, record dirty cells, compute velocity
    this.dirty.fill(0)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        let delta = 0

        const fxRight = x + 1 < W ? this.flowX[i] : 0
        const fxLeft  = x > 0     ? this.flowX[z * W + x - 1] : 0
        const fzDown  = z + 1 < D ? this.flowZ[i] : 0
        const fzUp    = z > 0     ? this.flowZ[(z - 1) * W + x] : 0

        delta = -fxRight + fxLeft - fzDown + fzUp

        const wBefore = grid.getWaterHeight(x, z) ?? 0
        const meanFlux =
          (Math.abs(fxRight) + Math.abs(fxLeft) + Math.abs(fzDown) + Math.abs(fzUp)) / 4
        // At a wetting front the flux belongs to an edge shared with a far deeper
        // neighbour, so dividing by this cell's depth overshoots the speed the
        // solver actually permits per edge.
        this.velocityArr[i] =
          wBefore > DRY_DEPTH ? Math.min(meanFlux / wBefore, MAX_VELOCITY) : 0

        const source = grid.getSourceRate(x, z) ?? 0
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
