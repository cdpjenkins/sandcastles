import { describe, it, expect } from 'vitest'
import { Grid } from './Grid.ts'

describe('Grid', () => {
  it('has the correct dimensions', () => {
    const grid = new Grid(256, 256)
    expect(grid.width).toBe(256)
    expect(grid.depth).toBe(256)
  })

  it('initialises beach with positive sand height', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    expect(grid.getSandHeight(0, 0)).toBeGreaterThan(0)
  })

  it('sea strip at far edge has zero sand height', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    expect(grid.getSandHeight(128, 255)).toBe(0)
  })

  it('sand height decreases toward sea edge', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const highGround = grid.getSandHeight(128, 0)!
    const lowGround = grid.getSandHeight(128, 200)!
    expect(highGround).toBeGreaterThan(lowGround)
  })

  it('setHeight and getSandHeight round-trip', () => {
    const grid = new Grid(256, 256)
    grid.setSandHeight(10, 20, 4.5)
    expect(grid.getSandHeight(10, 20)).toBeCloseTo(4.5)
  })

  it('setHeight does not affect adjacent cells', () => {
    const grid = new Grid(256, 256)
    grid.setSandHeight(10, 20, 4.5)
    expect(grid.getSandHeight(11, 20)).toBe(0)
    expect(grid.getSandHeight(10, 21)).toBe(0)
  })

  it('out-of-bounds access returns undefined', () => {
    const grid = new Grid(256, 256)
    expect(grid.getSandHeight(-1, 0)).toBeUndefined()
    expect(grid.getSandHeight(0, 256)).toBeUndefined()
  })

  it('rock height is always positive (immovable base)', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    for (let z = 0; z < 256; z += 32) {
      for (let x = 0; x < 256; x += 32) {
        expect(grid.getRockHeight(x, z)).toBeGreaterThan(0)
      }
    }
  })

  it('surface height is rock + sand', () => {
    const grid = new Grid(16, 16)
    grid.setSandHeight(5, 5, 3.0)
    grid.setRockHeight(5, 5, 1.0)
    expect(grid.getSurfaceHeight(5, 5)).toBeCloseTo(4.0)
  })
})
