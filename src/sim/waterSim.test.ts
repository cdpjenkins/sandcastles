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

  it('flow does not overshoot into a strong reversal while settling', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 4)
    grid.setWaterHeight(1, 0, 0)
    const sim = new WaterSim(grid.width, grid.depth)

    for (let i = 0; i < 30; i++) sim.step(grid, DT)

    expect(sim.getFlowX(0, 0)).toBeGreaterThan(-1.4)
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

describe('WaterSim dirty mask', () => {
  it('step returns a Uint8Array with length width*depth', () => {
    const grid = flatGrid(4, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    const dirty = sim.step(grid, DT)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(16)
  })

  it('dirty mask is set for a cell that gained water', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    const dirty = sim.step(grid, DT)
    expect(dirty[1]).toBe(1)
  })

  it('dirty mask is set for a cell that lost water', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    const dirty = sim.step(grid, DT)
    expect(dirty[0]).toBe(1)
  })

  it('dirty mask is zero for a cell with no water change', () => {
    const grid = flatGrid(3, 1)
    grid.setWaterHeight(0, 0, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    const dirty = sim.step(grid, DT)
    expect(dirty[2]).toBe(0)
  })

  it('stable grid with no water returns all-zero mask', () => {
    const grid = flatGrid(4, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    const dirty = sim.step(grid, DT)
    expect(Array.from(dirty).every(v => v === 0)).toBe(true)
  })
})

describe('WaterSim velocity', () => {
  it('getVelocity returns positive value where water is flowing', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 4)
    grid.setWaterHeight(1, 0, 0)
    const sim = new WaterSim(grid.width, grid.depth)
    sim.step(grid, DT)
    expect(sim.getVelocity(0, 0)).toBeGreaterThan(0)
  })

  it('getVelocity returns zero for a still cell', () => {
    const grid = flatGrid(4, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    sim.step(grid, DT)
    expect(sim.getVelocity(2, 2)).toBe(0)
  })

  it('getVelocity returns zero before first step', () => {
    const grid = flatGrid(2, 1)
    grid.setWaterHeight(0, 0, 4)
    const sim = new WaterSim(grid.width, grid.depth)
    expect(sim.getVelocity(0, 0)).toBe(0)
  })
})

describe('WaterSim cross-advection', () => {
  it('z-flow advects x-momentum to the downstream row', () => {
    // Flat terrain, water at rest everywhere — no pressure gradient, so pressure
    // term alone produces zero change in flowX.  We inject:
    //   flowZ = V  at rows z=1 and z=2 (z-flow flowing downward)
    //   flowX = F  at row z=1          (x-flow only at the upstream row)
    //
    // Cross-advection −v·(du/dz)·dt should carry the x-momentum from z=1
    // into z=2.  Without the term, flowX at z=2 stays zero.
    const W = 5, D = 5
    const grid = flatGrid(W, D)
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++)
        grid.setWaterHeight(x, z, 1.0)

    const sim = new WaterSim(W, D)
    const V = 1.0, F = 1.0
    for (let x = 0; x < W - 1; x++) {
      sim.setFlowZ(x, 1, V)
      sim.setFlowZ(x, 2, V)
      sim.setFlowX(x, 1, F)   // x-flow present at z=1
    }

    sim.step(grid, DT)

    // x-flow at z=2 should have grown (advection carried it downstream)
    expect(sim.getFlowX(2, 2)).toBeGreaterThan(0)
  })
})

describe('WaterSim flow accessors', () => {
  it('getFlowX returns 0 before any step', () => {
    const sim = new WaterSim(4, 4)
    expect(sim.getFlowX(1, 1)).toBe(0)
  })

  it('getFlowZ returns 0 before any step', () => {
    const sim = new WaterSim(4, 4)
    expect(sim.getFlowZ(1, 1)).toBe(0)
  })

  it('setFlowX and getFlowX round-trip', () => {
    const sim = new WaterSim(4, 4)
    sim.setFlowX(2, 1, 1.5)
    expect(sim.getFlowX(2, 1)).toBeCloseTo(1.5)
  })

  it('setFlowZ and getFlowZ round-trip', () => {
    const sim = new WaterSim(4, 4)
    sim.setFlowZ(2, 1, 2.5)
    expect(sim.getFlowZ(2, 1)).toBeCloseTo(2.5)
  })

  it('setFlowX does not affect adjacent cells', () => {
    const sim = new WaterSim(4, 4)
    sim.setFlowX(2, 1, 1.5)
    expect(sim.getFlowX(3, 1)).toBe(0)
    expect(sim.getFlowX(2, 2)).toBe(0)
  })
})

function totalWater(grid: Grid): number {
  let sum = 0
  for (let z = 0; z < grid.depth; z++)
    for (let x = 0; x < grid.width; x++)
      sum += grid.getWaterHeight(x, z) ?? 0
  return sum
}
