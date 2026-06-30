import { describe, it, expect } from 'vitest'
import { WaterSim } from './WaterSim.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30

const flatGrid = (w: number, d: number, rockH = 1.0) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++)
      g.setRockHeight(x, z, rockH)
  return g
}

describe('WaterSim', () => {
  it('water flows from a higher cell to a lower neighbour', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 4)
    grid.setWaterHeight(1, 0, 0)
    const sim = new WaterSim(grid.width, grid.depth)

    sim.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBeLessThan(4)
    expect(grid.getWaterHeight(1, 0)!).toBeGreaterThan(0)
  })

  it('water does not flow between equal-height cells', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 2)
    grid.setWaterHeight(1, 0, 2)
    const sim = new WaterSim(grid.width, grid.depth)

    sim.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBeCloseTo(2)
    expect(grid.getWaterHeight(1, 0)!).toBeCloseTo(2)
  })

  it('conserves total water volume (no sources)', () => {
    const grid = flatGrid(4, 4)
    grid.setWaterHeight(1, 1, 8)
    const sim = new WaterSim(grid.width, grid.depth)

    const before = totalWater(grid)
    for (let i = 0; i < 10; i++) sim.step(grid, DT)

    expect(totalWater(grid)).toBeCloseTo(before, 3)
  })

  it('water does not go negative', () => {
    const grid = flatGrid(3, 1)
    grid.setWaterHeight(0, 0, 0.001)
    const sim = new WaterSim(grid.width, grid.depth)

    for (let i = 0; i < 20; i++) sim.step(grid, DT)

    for (let x = 0; x < 3; x++)
      expect(grid.getWaterHeight(x, 0)!).toBeGreaterThanOrEqual(0)
  })

  it('source cell gains water each step', () => {
    const grid = flatGrid(1, 1)
    grid.setSourceRate(0, 0, 2.0)
    const sim = new WaterSim(grid.width, grid.depth)

    sim.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBeCloseTo(2.0 * DT, 4)
  })

  it('water blocked by higher terrain does not cross', () => {
    const grid = flatGrid(3, 1)
    grid.setRockHeight(1, 0, 10)
    grid.setWaterHeight(0, 0, 2)
    const sim = new WaterSim(grid.width, grid.depth)

    for (let i = 0; i < 30; i++) sim.step(grid, DT)

    expect(grid.getWaterHeight(2, 0)!).toBeCloseTo(0)
  })
})

function totalWater(grid: Grid): number {
  let sum = 0
  for (let z = 0; z < grid.depth; z++)
    for (let x = 0; x < grid.width; x++)
      sum += grid.getWaterHeight(x, z) ?? 0
  return sum
}
