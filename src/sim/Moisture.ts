import type { Grid } from '../core/Grid.ts'
import { settleSediment } from './settleSediment.ts'

// Moisture is water held in the sand, as an absolute amount spread evenly
// through the cell's whole depth of sand. A unit of sand holds POROSITY of
// water when saturated, so capacity grows with the sand and bare rock holds
// none. Water soaks in from the column above; what dries out is lost to the
// air.
export const POROSITY = 0.01
// Water per second that can soak into a cell's sand from the column above.
// Infiltration is a surface rate, so it is the same however deep the sand:
// a thin skin fills in a step, a deep dune takes several.
export const SOAK_RATE = 1.0
// Per edge, scaled by saturation difference: matches the old fraction-based
// diffusion, which pulled a cell towards its four neighbours' mean at 0.1/s.
const DIFFUSE_RATE = 0.1
// Water per second lost to the air from a cell not under water. Evaporation is
// a surface process, so deep sand loses no more than shallow and takes longer
// to dry.
const EVAPORATE_RATE = 0.0002
const DIRTY_EPSILON = 1e-4

// How full the sand is, 0-1: what the colours and the Look panel show. Rock
// holds nothing, but wet rock still looks wet.
export const saturation = (moisture: number, sand: number, water: number): number =>
  saturationOf(moisture, POROSITY * sand, water)

const saturationOf = (moisture: number, capacity: number, water: number): number => {
  if (capacity > 0) return Math.min(1, moisture / capacity)
  return water > 0 ? 1 : 0
}

export class Moisture {
  private readonly dirty: Uint8Array
  // Per-cell working copies, read once per step: the grid's getters are
  // bounds-checked, and three passes through them cost more than the sim.
  private readonly capacity: Float64Array
  private readonly held: Float64Array
  private readonly water: Float64Array
  private readonly before: Float64Array
  private readonly delta: Float64Array

  constructor(width: number, depth: number) {
    const size = width * depth
    this.dirty = new Uint8Array(size)
    this.capacity = new Float64Array(size)
    this.held = new Float64Array(size)
    this.water = new Float64Array(size)
    this.before = new Float64Array(size)
    this.delta = new Float64Array(size)
  }

  step(grid: Grid, dt: number): Uint8Array {
    const W = grid.width
    const D = grid.depth
    const { capacity, held, water, before, delta, dirty } = this

    dirty.fill(0)
    delta.fill(0)

    // Read, and soak: a cell under water fills its sand from the column above,
    // no faster than SOAK_RATE.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        const w = grid.getWaterHeight(x, z) ?? 0
        const m = grid.getMoisture(x, z) ?? 0
        const cap = POROSITY * (grid.getSandHeight(x, z) ?? 0)
        capacity[i] = cap
        before[i] = saturationOf(m, cap, w)

        const absorbed = w > 0 ? Math.min(w, cap - m, SOAK_RATE * dt) : 0
        if (absorbed > 0) {
          const remaining = w - absorbed
          grid.setWaterHeight(x, z, remaining)
          held[i] = m + absorbed
          water[i] = remaining
          // A film soaked up whole leaves a dry cell, and that is the one
          // transition that must reach the mesh however small.
          if (remaining === 0) {
            settleSediment(grid, x, z)
            dirty[i] = 1
          }
        } else {
          held[i] = m
          water[i] = w
        }
      }
    }

    // Spread: water moves across each edge from the fuller sand to the
    // emptier, limited by the smaller of the two capacities so neither
    // overshoots. Accumulated before applying, so it conserves water.
    const edge = (DIFFUSE_RATE / 4) * dt
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const a = z * W + x
        const capA = capacity[a]!
        if (capA === 0) continue
        const satA = held[a]! / capA
        if (x + 1 < W) this.spread(a, a + 1, capA, satA, edge)
        if (z + 1 < D) this.spread(a, a + W, capA, satA, edge)
      }
    }

    // Apply, then dry anything not under water.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x
        let m = held[i]! + delta[i]!
        if (water[i]! <= 0) m -= EVAPORATE_RATE * dt
        m = Math.max(0, m)
        grid.setMoisture(x, z, m)

        if (Math.abs(saturationOf(m, capacity[i]!, water[i]!) - before[i]!) > DIRTY_EPSILON) {
          dirty[i] = 1
        }
      }
    }

    return dirty
  }

  private spread(a: number, b: number, capA: number, satA: number, edge: number): void {
    const capB = this.capacity[b]!
    if (capB === 0) return
    const flow = edge * (satA - this.held[b]! / capB) * Math.min(capA, capB)
    this.delta[a] -= flow
    this.delta[b] += flow
  }
}
