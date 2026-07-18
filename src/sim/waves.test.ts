import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Grid } from '../core/Grid.ts'

// Small grid: width=4, depth=8, seaZ=6 (mimics depth*0.75)
const SEA_Z = 6
// Waves holds only the outermost row, as an open boundary; everything inshore of
// it is left to the water sim.
const BOUNDARY_Z = 7
const BED_HEIGHT = 1
// Waves is given a sea surface *elevation*; the depth it should produce is
// whatever puts the surface there, given the bed underneath.
const SEA_SURFACE = 2
const SEA_DEPTH = SEA_SURFACE - BED_HEIGHT
const makeGrid = () => {
  const g = new Grid(4, 8)
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 4; x++) {
      g.setRockHeight(x, z, BED_HEIGHT)
      if (z >= SEA_Z) g.setWaterHeight(x, z, SEA_DEPTH)
    }
  return g
}

describe('Waves', () => {
  it('the boundary row is capped at sea level each step', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, BOUNDARY_Z, 99)
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_SURFACE)

    expect(grid.getWaterHeight(0, BOUNDARY_Z)!).toBeLessThanOrEqual(SEA_DEPTH)
  })

  it('the boundary row rises to meet a higher sea level', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_SURFACE + 0.4)

    expect(grid.getWaterHeight(0, BOUNDARY_Z)!).toBeCloseTo(SEA_DEPTH + 0.4, 5)
  })

  it('the boundary row falls to meet a lower sea level', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_SURFACE - 0.4)

    expect(grid.getWaterHeight(0, BOUNDARY_Z)!).toBeCloseTo(SEA_DEPTH - 0.4, 5)
  })

  it('a sea cell inshore of the boundary is left for the water sim to move', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, SEA_Z, 99)
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_SURFACE)

    expect(grid.getWaterHeight(0, SEA_Z)!).toBe(99)
  })

  it('timeUntilWave counts down', () => {
    const waves = new Waves(4, 8)
    const before = waves.timeUntilWave
    waves.step(new Grid(4, 8), 1, SEA_SURFACE)
    expect(waves.timeUntilWave).toBeLessThan(before)
  })

  it('timer resets after wave fires', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    const steps = Math.ceil(waves.period / (1 / 30)) + 1
    for (let i = 0; i < steps; i++) waves.step(grid, 1 / 30, SEA_SURFACE)

    expect(waves.timeUntilWave).toBeCloseTo(waves.period, 0)
  })
})

describe('Waves on the real beach', () => {
  it('leaves a disturbance in the open sea alone', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const waves = new Waves(grid.width, grid.depth)
    const x = 128
    const z = 230
    const before = grid.getWaterHeight(x, z)!

    grid.setWaterHeight(x, z, before + 2)
    waves.step(grid, 1 / 30, grid.seaLevel)

    expect(grid.getWaterHeight(x, z)!).toBeGreaterThan(before + 1)
  })

  it('leaves the sea surface flat at seaLevel across the sloped sea floor', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const waves = new Waves(grid.width, grid.depth)
    const x = 128

    waves.step(grid, 1 / 30, grid.seaLevel)

    for (let z = grid.seaStart; z < grid.depth; z++) {
      const surface =
        grid.getRockHeight(x, z)! + grid.getSandHeight(x, z)! + grid.getWaterHeight(x, z)!
      expect(surface).toBeCloseTo(grid.seaLevel, 5)
    }
  })
})

describe('Waves dirty mask', () => {
  it('step returns a Uint8Array with length width*depth', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    const dirty = waves.step(grid, 1 / 30, SEA_SURFACE)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(32)
  })

  it('a boundary cell already at sea level is not flagged on a non-firing tick', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, 1 / 30, SEA_SURFACE)

    expect(dirty[BOUNDARY_Z * 4]).toBe(0)
  })

  it('a boundary cell genuinely clamped down from above sea level is flagged dirty', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, BOUNDARY_Z, 99)
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, 1 / 30, SEA_SURFACE)

    expect(dirty[BOUNDARY_Z * 4]).toBe(1)
  })

  it('a boundary cell raised to meet a rising tide is flagged dirty', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, 1 / 30, SEA_SURFACE + 0.4)

    expect(dirty[BOUNDARY_Z * 4]).toBe(1)
  })
})
