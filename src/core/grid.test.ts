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

  it('inland row has high height variance (bumpy terrain)', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    let sum = 0
    let sumSq = 0
    const N = 256
    for (let x = 0; x < N; x++) {
      const h = grid.getSandHeight(x, 10)!
      sum += h
      sumSq += h * h
    }
    const variance = sumSq / N - (sum / N) ** 2
    expect(variance).toBeGreaterThan(25)
  })

  it('inland terrain is bumpier than near-shore terrain', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const variance = (z: number) => {
      let sum = 0, sumSq = 0
      for (let x = 0; x < 256; x++) {
        const h = grid.getSandHeight(x, z)!
        sum += h; sumSq += h * h
      }
      return sumSq / 256 - (sum / 256) ** 2
    }
    expect(variance(10)).toBeGreaterThan(variance(170) * 2)
  })

  it('slope is gentler near the sea than inland', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const avgDrop = (z: number) => {
      let sum = 0
      for (let x = 0; x < 256; x += 16)
        sum += Math.abs((grid.getSandHeight(x, z)! - grid.getSandHeight(x, z + 1)!))
      return sum / 16
    }
    expect(avgDrop(20)).toBeGreaterThan(avgDrop(170))
  })

  it('beach has fractal height variation across cells at the same depth', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const heights = new Set<number>()
    for (let x = 0; x < 64; x++) heights.add(grid.getSandHeight(x, 50)!)
    expect(heights.size).toBeGreaterThan(32)
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

  it('sourceRate defaults to zero', () => {
    const grid = new Grid(16, 16)
    expect(grid.getSourceRate(4, 4)).toBe(0)
  })

  it('setSourceRate and getSourceRate round-trip', () => {
    const grid = new Grid(16, 16)
    grid.setSourceRate(4, 4, 2.5)
    expect(grid.getSourceRate(4, 4)).toBeCloseTo(2.5)
  })

  it('setSourceRate does not affect adjacent cells', () => {
    const grid = new Grid(16, 16)
    grid.setSourceRate(4, 4, 2.5)
    expect(grid.getSourceRate(5, 4)).toBe(0)
    expect(grid.getSourceRate(4, 5)).toBe(0)
  })

  it('getSourceRate returns undefined out of bounds', () => {
    const grid = new Grid(16, 16)
    expect(grid.getSourceRate(-1, 0)).toBeUndefined()
    expect(grid.getSourceRate(0, 16)).toBeUndefined()
  })

  it('getSediment defaults to zero', () => {
    const grid = new Grid(16, 16)
    expect(grid.getSediment(5, 5)).toBe(0)
  })

  it('setSediment and getSediment round-trip', () => {
    const grid = new Grid(16, 16)
    grid.setSediment(5, 5, 1.5)
    expect(grid.getSediment(5, 5)).toBeCloseTo(1.5)
  })

  it('setSediment does not affect adjacent cells', () => {
    const grid = new Grid(16, 16)
    grid.setSediment(5, 5, 1.5)
    expect(grid.getSediment(6, 5)).toBe(0)
    expect(grid.getSediment(5, 6)).toBe(0)
  })

  it('getSediment returns undefined out of bounds', () => {
    const grid = new Grid(16, 16)
    expect(grid.getSediment(-1, 0)).toBeUndefined()
    expect(grid.getSediment(0, 16)).toBeUndefined()
  })
})
