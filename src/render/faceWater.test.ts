import { describe, it, expect } from 'vitest'
import { Grid } from '../core/Grid.ts'
import { showsWater } from './faceWater.ts'

// A cliff along z: rows 0..4 are a plateau 10 high, rows 5.. the ground at 0.
function cliff(): Grid {
  const grid = new Grid(8, 10)
  for (let z = 0; z < 5; z++) {
    for (let x = 0; x < 8; x++) grid.setRockHeight(x, z, 10)
  }
  return grid
}

describe('showsWater', () => {
  it('a dry cell shows no water', () => {
    expect(showsWater(cliff(), 3, 7)).toBe(false)
  })

  it('a wet cell on open ground shows its water', () => {
    const grid = cliff()
    grid.setWaterHeight(3, 8, 0.5)
    expect(showsWater(grid, 3, 8)).toBe(true)
  })

  it('a pool at the foot of a dry cliff does not paint the face', () => {
    const grid = cliff()
    grid.setWaterHeight(3, 5, 0.5)
    expect(showsWater(grid, 3, 5)).toBe(false)
  })

  it('the foot shows water where water comes over the lip above it', () => {
    const grid = cliff()
    grid.setWaterHeight(3, 5, 0.5)
    grid.setWaterHeight(3, 4, 0.05)
    expect(showsWater(grid, 3, 5)).toBe(true)
  })

  it('a wet lip diagonally above is enough, so the fall keeps its width', () => {
    const grid = cliff()
    grid.setWaterHeight(3, 5, 0.5)
    grid.setWaterHeight(4, 4, 0.05)
    expect(showsWater(grid, 3, 5)).toBe(true)
  })

  it('a pool against a bank no higher than a sand slope still shows', () => {
    const grid = new Grid(8, 10)
    for (let x = 0; x < 8; x++) grid.setSandHeight(x, 4, 0.9)
    grid.setWaterHeight(3, 5, 0.3)
    expect(showsWater(grid, 3, 5)).toBe(true)
  })

  it('a pool deep enough to reach up the face still shows', () => {
    const grid = cliff()
    grid.setWaterHeight(3, 5, 9.5)
    expect(showsWater(grid, 3, 5)).toBe(true)
  })
})
