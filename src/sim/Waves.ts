import type { Grid } from '../core/Grid.ts'

// Tuned so a castle on the shoreline weathers rather than dissolves: at
// 2.0/0.3 a cone lost 61% of its sand to 60s of waves, which is a castle gone
// while you watch. At 3.5/0.15 it loses 11%, against an unchanged 3.4% on a
// flat sea, so the swell is still clearly what does the damage.
//
// Both knobs cost refraction, and the period costs more of it than the
// amplitude does. Refraction only shows if several wavelengths fit across the
// sloping floor -- at 5s the wavelength was 70 cells against a 56-row sea,
// under one, and Snell, which assumes depth varies slowly over a wavelength,
// did not apply at all. 3.5s puts it at 49 cells, so a little over one
// wavelength fits. Measured as the swell's spread between the near and far
// shore: 0.58 at 2.0/0.3, 0.18 from the longer period alone, 0.09 here.
// Nothing tests refraction -- it is emergent -- so lengthening this further
// will quietly flatten it with the suite still green.
const SWELL_PERIOD = 3.5
const SWELL_AMPLITUDE = 0.15
// Celerity at the boundary depth, sqrt(9.8 * 20). Only sets the phase ramp
// across the sponge; once inshore the sim carries the wave at its own sqrt(g*h).
const SWELL_SPEED = 14
// How far off the shore-normal the swell arrives. Refraction is emergent from
// c = sqrt(g*h) once there is an angle to bend: a wave arriving square on has
// nothing to turn.
const SWELL_ANGLE = Math.PI / 6
const BOUNDARY_ROWS = 1
const DIRTY_EPSILON = 1e-4

export interface WavesSnapshot {
  elapsed: number
  timeUntilWave: number
}

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

  snapshot(): WavesSnapshot {
    return { elapsed: this.elapsed, timeUntilWave: this.timeUntilWave }
  }

  restore(snapshot: WavesSnapshot): void {
    this.elapsed = snapshot.elapsed
    this.timeUntilWave = snapshot.timeUntilWave
  }

  // Surface elevation of the incident swell. The wave runs shoreward, towards
  // decreasing z, so seaward rows lead in phase and inshore rows lag; the x term
  // tilts the crests off shore-parallel so there is an angle for the shallows to
  // work on.
  surfaceAt(x: number, z: number, seaSurface: number): number {
    const k = (2 * Math.PI) / (SWELL_SPEED * SWELL_PERIOD)
    const phase =
      (2 * Math.PI * this.elapsed) / SWELL_PERIOD +
      k * Math.cos(SWELL_ANGLE) * (z - (this.depth - 1)) -
      k * Math.sin(SWELL_ANGLE) * x
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
      for (let x = 0; x < W; x++) {
        const surface = this.surfaceAt(x, z, seaSurface)
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
