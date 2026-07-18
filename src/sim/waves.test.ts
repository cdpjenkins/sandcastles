import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Grid } from '../core/Grid.ts'

// Small grid: width=4, depth=8, seaZ=6 (mimics depth*0.75)
const SEA_Z = 6
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
  it('shore row gains water after one full period elapses', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    const shoreZ = SEA_Z - 1

    const waterBefore = grid.getWaterHeight(0, shoreZ)!
    const steps = Math.ceil(waves.period / (1 / 30)) + 1
    for (let i = 0; i < steps; i++) waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)

    expect(grid.getWaterHeight(0, shoreZ)!).toBeGreaterThan(waterBefore)
  })

  it('sea cells are capped at sea level each step', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, SEA_Z, 99)
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)

    expect(grid.getWaterHeight(0, SEA_Z)!).toBeLessThanOrEqual(SEA_DEPTH)
  })

  it('sea cells rise to meet a higher sea level', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE + 0.4)

    expect(grid.getWaterHeight(0, SEA_Z)!).toBeCloseTo(SEA_DEPTH + 0.4, 5)
  })

  it('sea cells fall to meet a lower sea level', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE - 0.4)

    expect(grid.getWaterHeight(0, SEA_Z)!).toBeCloseTo(SEA_DEPTH - 0.4, 5)
  })

  it('timeUntilWave counts down', () => {
    const waves = new Waves(4, 8)
    const before = waves.timeUntilWave
    waves.step(new Grid(4, 8), 1, 6, SEA_SURFACE)
    expect(waves.timeUntilWave).toBeLessThan(before)
  })

  it('timer resets after wave fires', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    const steps = Math.ceil(waves.period / (1 / 30)) + 1
    for (let i = 0; i < steps; i++) waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)

    expect(waves.timeUntilWave).toBeCloseTo(waves.period, 0)
  })
})

describe('Waves on the real beach', () => {
  it('holds the sea surface flat at seaLevel across the sloped sea floor', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const waves = new Waves(grid.width, grid.depth)
    const seaZ = grid.seaStart + 4
    const x = 128

    waves.step(grid, 1 / 30, seaZ, grid.seaLevel)

    for (let z = seaZ; z < grid.depth; z++) {
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
    const dirty = waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(32)
  })

  it('surge rows are flagged dirty on the firing tick', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    let dirty = waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)
    while (!waves.fired) dirty = waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)

    expect(waves.fired).toBe(true)
    const shoreZ = SEA_Z - 1
    expect(dirty[shoreZ * 4]).toBe(1)
  })

  it('a sea cell already at sea level is not flagged on a non-firing tick', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)

    expect(dirty[SEA_Z * 4]).toBe(0)
  })

  it('a sea cell genuinely clamped down from above sea level is flagged dirty', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, SEA_Z, 99)
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE)

    expect(dirty[SEA_Z * 4]).toBe(1)
  })

  it('a sea cell raised to meet a rising tide is flagged dirty', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, 1 / 30, SEA_Z, SEA_SURFACE + 0.4)

    expect(dirty[SEA_Z * 4]).toBe(1)
  })
})
