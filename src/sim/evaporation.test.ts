import { describe, it, expect } from 'vitest'
import { Evaporation } from './Evaporation.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30
const RESIDUAL_FILM = 1e-4
const ABOVE_SEA = 100

const drySlab = (w: number, d: number) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++)
      g.setRockHeight(x, z, ABOVE_SEA)
  return g
}

const runFor = (grid: Grid, evaporation: Evaporation, seconds: number, seaSurface = 0) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) evaporation.step(grid, DT, seaSurface)
}

describe('Evaporation', () => {
  it('takes water from a cell whatever its depth, with no threshold to hide behind', () => {
    const grid = drySlab(2, 1)
    grid.setWaterHeight(0, 0, 0.005)
    grid.setWaterHeight(1, 0, 0.5)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 60)

    expect(grid.getWaterHeight(0, 0)!).toBeLessThan(0.005)
    expect(grid.getWaterHeight(1, 0)!).toBeLessThan(0.5)
  })

  it('takes the same depth from a shallow cell as a deep one over the same time', () => {
    const grid = drySlab(2, 1)
    grid.setWaterHeight(0, 0, 0.02)
    grid.setWaterHeight(1, 0, 0.2)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 60)

    // Not toBeCloseTo to 6 dp: `water` is a Float32Array and the per-step
    // subtraction is 6.7e-7, so quantisation costs a deep column a few percent
    // of its loss. The behaviour under test is that depth does not set the
    // rate, which a ratio states without pinning the noise.
    const shallowLoss = 0.02 - grid.getWaterHeight(0, 0)!
    const deepLoss = 0.2 - grid.getWaterHeight(1, 0)!
    expect(shallowLoss / deepLoss).toBeGreaterThan(0.9)
    expect(shallowLoss / deepLoss).toBeLessThan(1.1)
  })

  it('dries a residual film to exactly zero', () => {
    const grid = drySlab(1, 1)
    grid.setWaterHeight(0, 0, RESIDUAL_FILM)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 60)

    expect(grid.getWaterHeight(0, 0)!).toBe(0)
  })

  it('empties a shallow puddle far more slowly than a film, but empties it', () => {
    const grid = drySlab(1, 1)
    grid.setWaterHeight(0, 0, 0.01)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 60)
    expect(grid.getWaterHeight(0, 0)!).toBeGreaterThan(0)

    runFor(grid, evaporation, 600)
    expect(grid.getWaterHeight(0, 0)!).toBe(0)
  })

  it('leaves the sea alone, since the ocean replenishes what it loses', () => {
    const grid = new Grid(1, 1)
    grid.setRockHeight(0, 0, 0)
    grid.setWaterHeight(0, 0, 4.0)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 600, 4.0)

    expect(grid.getWaterHeight(0, 0)!).toBe(4.0)
  })

  it('evaporates a puddle stranded above the waterline', () => {
    const grid = new Grid(1, 1)
    grid.setRockHeight(0, 0, 10)
    grid.setWaterHeight(0, 0, 0.01)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 600, 4.0)

    expect(grid.getWaterHeight(0, 0)!).toBe(0)
  })

  it('follows the tide: a cell the risen sea has claimed stops evaporating', () => {
    const grid = new Grid(1, 1)
    grid.setRockHeight(0, 0, 4.5)
    grid.setWaterHeight(0, 0, 0.2)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 60, 4.0)
    const atLowTide = grid.getWaterHeight(0, 0)!
    expect(atLowTide).toBeLessThan(0.2)

    runFor(grid, evaporation, 60, 5.0)

    expect(grid.getWaterHeight(0, 0)!).toBe(atLowTide)
  })

  it('leaves an already dry cell at zero', () => {
    const grid = drySlab(1, 1)
    grid.setWaterHeight(0, 0, 0)
    const evaporation = new Evaporation(grid.width, grid.depth)

    runFor(grid, evaporation, 1)

    expect(grid.getWaterHeight(0, 0)!).toBe(0)
  })
})
