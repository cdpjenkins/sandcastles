import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from './WaterSim.ts'

// Capacity is the stream power a cell has to spare: how fast the water moves
// times how steeply it is running downhill, less the CRITICAL_POWER below which
// the bed does not move at all. Speed alone cannot tell a channel from a sheet
// wash, since a thin film racing across flat ground moves as fast as the thalweg
// -- it is the slope term that lets water gathering into a channel cut harder
// there than over the ground either side, so incision concentrates instead of
// spreading.
const EROSION_K = 40
const DEPOSITION_K = 0.5
// The most the bed may move in a second. Moving it is a step change in the water
// surface above it, so an unbounded rate feeds back on itself: scour deepens the
// channel, the channel speeds the water, the faster water scours harder. This
// decouples stability from EROSION_K, leaving that free as a tuning knob.
const MAX_BED_RATE = 0.3
// Grains do not creep at the first hint of a current: below a critical stream
// power the bed simply holds. Without that floor every wet cell scours whatever
// the water is doing, so an enclosed lake strips its own bed, and since the
// surface is bed + water, a bed shifting under a standing wave feeds the wave.
const CRITICAL_POWER = 0.3
const MIN_WATER_TO_ERODE = 1e-5
const DIRTY_EPSILON = 1e-4

// Central difference on the water surface, clamped at the edges so the boundary
// reads a one-sided gradient rather than falling off the grid.
const surfaceSlope = (grid: Grid, x: number, z: number): number => {
  const surfaceAt = (sx: number, sz: number): number =>
    (grid.getSurfaceHeight(sx, sz) ?? 0) + (grid.getWaterHeight(sx, sz) ?? 0)

  return Math.hypot(
    (surfaceAt(Math.min(x + 1, grid.width - 1), z) - surfaceAt(Math.max(x - 1, 0), z)) / 2,
    (surfaceAt(x, Math.min(z + 1, grid.depth - 1)) - surfaceAt(x, Math.max(z - 1, 0))) / 2,
  )
}

export class Erosion {
  private readonly dirty: Uint8Array
  // Scratch buffers for transportSediment, held rather than allocated per
  // step: three Float32Array(65536) every step at 30 Hz is ~23 MB/s of
  // garbage, and the collector pressure was enough to make the tab a target
  // for Chrome's memory saver.
  //
  // Safe to reuse without clearing, but only just. concentration is written
  // for every cell. The edge fluxes are not: edgeFluxX skips column W-1 and
  // edgeFluxZ skips row D-1, so those entries hold the previous step's
  // values. Nothing reads them - every read is either guarded by the same
  // bound that guards the write, or indexes i-1 / i-W, which can only reach
  // a cell the write covered. Keep it that way when editing the loops below.
  private readonly concentration: Float32Array
  private readonly edgeFluxX: Float32Array
  private readonly edgeFluxZ: Float32Array

  constructor(width: number, depth: number) {
    this.dirty = new Uint8Array(width * depth)
    this.concentration = new Float32Array(width * depth)
    this.edgeFluxX = new Float32Array(width * depth)
    this.edgeFluxZ = new Float32Array(width * depth)
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
        const streamPower = velocity * surfaceSlope(grid, x, z)
        const capacity = Math.max(0, streamPower - CRITICAL_POWER) * EROSION_K
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
    const concentration = this.concentration
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
    const edgeFluxX = this.edgeFluxX
    const edgeFluxZ = this.edgeFluxZ
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
