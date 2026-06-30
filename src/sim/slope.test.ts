import { describe, it, expect } from 'vitest'
import { Slope } from './Slope.ts'
import { Grid } from '../core/Grid.ts'

const makeGrid = (w = 4, d = 1) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) g.setRockHeight(x, z, 1)
  return g
}

describe('Slope', () => {
  it('tall sand column collapses toward flat neighbour', () => {
    const grid = makeGrid()
    grid.setSandHeight(0, 0, 20)
    grid.setSandHeight(1, 0, 0)
    const slope = new Slope()

    for (let i = 0; i < 50; i++) slope.step(grid)

    expect(grid.getSandHeight(0, 0)!).toBeLessThan(20)
    expect(grid.getSandHeight(1, 0)!).toBeGreaterThan(0)
  })

  it('conserves total sand volume', () => {
    const grid = makeGrid()
    grid.setSandHeight(0, 0, 20)
    grid.setSandHeight(1, 0, 0)
    const totalBefore =
      (grid.getSandHeight(0, 0) ?? 0) + (grid.getSandHeight(1, 0) ?? 0)
    const slope = new Slope()

    for (let i = 0; i < 50; i++) slope.step(grid)

    const totalAfter = [0, 1, 2, 3].reduce(
      (sum, x) => sum + (grid.getSandHeight(x, 0) ?? 0),
      0,
    )
    expect(totalAfter).toBeCloseTo(totalBefore, 3)
  })

  it('gentle slope within angle-of-repose does not move', () => {
    const grid = makeGrid(4, 1)
    // tan(20°) ≈ 0.364 per unit horizontal; each cell ~1 unit apart
    // surface height 5 at x=0 tapering by 0.3 per step — within stability
    grid.setSandHeight(0, 0, 5)
    grid.setSandHeight(1, 0, 4.7)
    grid.setSandHeight(2, 0, 4.4)
    grid.setSandHeight(3, 0, 4.1)
    const before = [0, 1, 2, 3].map(x => grid.getSandHeight(x, 0)!)
    const slope = new Slope()

    for (let i = 0; i < 10; i++) slope.step(grid)

    for (let x = 0; x < 4; x++) {
      expect(grid.getSandHeight(x, 0)!).toBeCloseTo(before[x]!, 2)
    }
  })

  it('flat terrain stays flat', () => {
    const grid = makeGrid(4, 4)
    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++) grid.setSandHeight(x, z, 5)
    const slope = new Slope()

    for (let i = 0; i < 20; i++) slope.step(grid)

    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++)
        expect(grid.getSandHeight(x, z)!).toBeCloseTo(5, 3)
  })
})
