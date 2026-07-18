import type { Grid } from '../core/Grid.ts'

const SWELL_PERIOD = 5.0
const SWELL_AMPLITUDE = 0.5
// Celerity at the boundary depth, sqrt(9.8 * 20). Only sets the phase ramp
// across the sponge; once inshore the sim carries the wave at its own sqrt(g*h).
const SWELL_SPEED = 14
const BOUNDARY_ROWS = 1
const DIRTY_EPSILON = 1e-4

export class Waves {
  readonly period = SWELL_PERIOD
  timeUntilWave = SWELL_PERIOD
  fired = false

  private elapsed = 0
  private readonly dirty: Uint8Array
  private readonly width: number
  private readonly depth: number

  constructor(width: number, depth: number) {
    this.width = width
    this.depth = depth
    this.dirty = new Uint8Array(width * depth)
  }

  // Surface elevation of the incident swell at row z. The wave runs shoreward,
  // towards decreasing z, so seaward rows lead in phase and inshore rows lag.
  surfaceAt(z: number, seaSurface: number): number {
    const k = (2 * Math.PI) / (SWELL_SPEED * SWELL_PERIOD)
    const phase = (2 * Math.PI * this.elapsed) / SWELL_PERIOD + k * (z - (this.depth - 1))
    return seaSurface + SWELL_AMPLITUDE * Math.sin(phase)
  }

  step(grid: Grid, dt: number, seaSurface: number): Uint8Array {
    this.fired = false
    this.elapsed += dt
    this.timeUntilWave -= dt
    if (this.timeUntilWave <= 0) {
      this.fired = true
      this.timeUntilWave += SWELL_PERIOD
    }
    this.dirty.fill(0)

    const W = grid.width
    const D = grid.depth

    for (let z = D - BOUNDARY_ROWS; z < D; z++) {
      const surface = this.surfaceAt(z, seaSurface)
      for (let x = 0; x < W; x++) {
        const bed = grid.getSurfaceHeight(x, z) ?? 0
        const target = Math.max(0, surface - bed)
        const w = grid.getWaterHeight(x, z) ?? 0
        if (Math.abs(w - target) > DIRTY_EPSILON) {
          grid.setWaterHeight(x, z, target)
          this.dirty[z * this.width + x] = 1
        }
      }
    }

    return this.dirty
  }
}
