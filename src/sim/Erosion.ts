import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from './WaterSim.ts'

const EROSION_K = 0.5
const DEPOSITION_K = 0.5
// The most the bed may move in a second. Moving it is a step change in the water
// surface above it, so an unbounded rate feeds back on itself: scour deepens the
// channel, the channel speeds the water, the faster water scours harder. This
// decouples stability from EROSION_K, leaving that free as a tuning knob.
const MAX_BED_RATE = 0.3
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

    this.transportSediment(grid, waterSim, dt)

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
          const erode = Math.min((capacity - sediment) * dt, sand, MAX_BED_RATE * dt)
          newSand = sand - erode
          grid.setSandHeight(x, z, newSand)
          grid.setSediment(x, z, sediment + erode)
        } else if (sediment > capacity) {
          const deposit = Math.min((sediment - capacity) * DEPOSITION_K * dt, sediment, MAX_BED_RATE * dt)
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

  private transportSediment(grid: Grid, waterSim: WaterSim, dt: number): void {
    const W = grid.width
    const D = grid.depth
    const N = W * D

    const concentration = new Float32Array(N)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        const water = grid.getWaterHeight(x, z) ?? 0
        const sediment = grid.getSediment(x, z) ?? 0
        concentration[i] = water > MIN_WATER_TO_ERODE ? sediment / water : 0
      }
    }

    // Sediment flux across each edge, carried at the upwind cell's concentration
    // (the same pipes WaterSim used to move water this tick move sediment with it).
    const edgeFluxX = new Float32Array(N)
    const edgeFluxZ = new Float32Array(N)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        if (x + 1 < W) {
          const flow = waterSim.getFlowX(x, z)
          edgeFluxX[i] = flow * (flow >= 0 ? concentration[i] : concentration[i + 1])
        }
        if (z + 1 < D) {
          const flow = waterSim.getFlowZ(x, z)
          edgeFluxZ[i] = flow * (flow >= 0 ? concentration[i] : concentration[i + W])
        }
      }
    }

    // Scale down outflows so no cell loses more sediment than it has.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        const sediment = grid.getSediment(x, z) ?? 0

        let outflow = 0
        if (x + 1 < W && edgeFluxX[i] > 0) outflow += edgeFluxX[i]
        if (x > 0 && edgeFluxX[i - 1] < 0) outflow -= edgeFluxX[i - 1]
        if (z + 1 < D && edgeFluxZ[i] > 0) outflow += edgeFluxZ[i]
        if (z > 0 && edgeFluxZ[i - W] < 0) outflow -= edgeFluxZ[i - W]

        const maxOut = sediment / dt
        if (outflow > maxOut && outflow > 0) {
          const scale = maxOut / outflow
          if (x + 1 < W && edgeFluxX[i] > 0) edgeFluxX[i] *= scale
          if (x > 0 && edgeFluxX[i - 1] < 0) edgeFluxX[i - 1] *= scale
          if (z + 1 < D && edgeFluxZ[i] > 0) edgeFluxZ[i] *= scale
          if (z > 0 && edgeFluxZ[i - W] < 0) edgeFluxZ[i - W] *= scale
        }
      }
    }

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        let delta = 0
        if (x + 1 < W) delta -= edgeFluxX[i]
        if (x > 0) delta += edgeFluxX[i - 1]
        if (z + 1 < D) delta -= edgeFluxZ[i]
        if (z > 0) delta += edgeFluxZ[i - W]

        const sediment = grid.getSediment(x, z) ?? 0
        grid.setSediment(x, z, Math.max(0, sediment + delta * dt))
      }
    }
  }
}
