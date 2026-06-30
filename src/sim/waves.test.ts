import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Grid } from '../core/Grid.ts'

// Small grid: width=4, depth=8, seaZ=6 (mimics depth*0.75)
const SEA_Z = 6
const makeGrid = () => {
  const g = new Grid(4, 8)
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 4; x++) {
      g.setRockHeight(x, z, 1)
      if (z >= SEA_Z) g.setWaterHeight(x, z, 1)
    }
  return g
}

describe('Waves', () => {
  it('shore row gains water after one full period elapses', () => {
    const grid = makeGrid()
    const waves = new Waves()
    const shoreZ = SEA_Z - 1

    const waterBefore = grid.getWaterHeight(0, shoreZ)!
    const steps = Math.ceil(waves.period / (1 / 30)) + 1
    for (let i = 0; i < steps; i++) waves.step(grid, 1 / 30, SEA_Z)

    expect(grid.getWaterHeight(0, shoreZ)!).toBeGreaterThan(waterBefore)
  })

  it('sea cells are capped at sea level each step', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, SEA_Z, 99)
    const waves = new Waves()

    waves.step(grid, 1 / 30, SEA_Z)

    expect(grid.getWaterHeight(0, SEA_Z)!).toBeLessThanOrEqual(waves.seaLevel)
  })

  it('timeUntilWave counts down', () => {
    const waves = new Waves()
    const before = waves.timeUntilWave
    waves.step(new Grid(4, 8), 1, 6)
    expect(waves.timeUntilWave).toBeLessThan(before)
  })

  it('timer resets after wave fires', () => {
    const grid = makeGrid()
    const waves = new Waves()
    const steps = Math.ceil(waves.period / (1 / 30)) + 1
    for (let i = 0; i < steps; i++) waves.step(grid, 1 / 30, SEA_Z)

    expect(waves.timeUntilWave).toBeCloseTo(waves.period, 0)
  })
})
