import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Grid } from '../core/Grid.ts'

const makeGrid = () => {
  const g = new Grid(4, 8)
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 4; x++) {
      g.setRockHeight(x, z, 1)
      if (z >= 6) g.setWaterHeight(x, z, 1)
    }
  return g
}

describe('Waves.fired', () => {
  it('is false before a wave fires', () => {
    const waves = new Waves(4, 8)
    waves.step(makeGrid(), 1 / 30, 2)
    expect(waves.fired).toBe(false)
  })

  it('is true in the step a wave fires', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    waves.step(grid, waves.period + 0.1, 2)
    expect(waves.fired).toBe(true)
  })

  it('resets to false on the next step after firing', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    waves.step(grid, waves.period + 0.1, 2)
    waves.step(grid, 1 / 30, 2)
    expect(waves.fired).toBe(false)
  })
})
