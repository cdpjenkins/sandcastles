import { describe, it, expect } from 'vitest'
import { Slope } from './Slope.ts'
import { Grid } from '../core/Grid.ts'

const makeGrid = (w = 4, d = 1) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) g.setRockHeight(x, z, 1)
  return g
}

const DT = 1 / 30

describe('Slope', () => {
  it('slumps at a rate per second, not a fraction per step', () => {
    // The bank relaxes over time, so how much sand moves in a given second is a
    // property of the sand, not of how finely the second was divided.  Refining
    // the timestep may only sharpen the answer -- it must not slump more, which
    // is what a per-step fraction does: halve dt and it relaxes twice as fast,
    // putting the slump rate at the mercy of SIM_HZ.
    //
    // Stated as a ratio between two refinements rather than an amount, because
    // the amount is set by the rate knob.  Any rate worth shipping lands in this
    // window; a per-step fraction lands at 1.25.
    const slumpedOver = (seconds: number, steps: number): number => {
      const grid = makeGrid(8, 1)
      grid.setSandHeight(0, 0, 20)
      const slope = new Slope(8, 1)
      for (let i = 0; i < steps; i++) slope.step(grid, seconds / steps)
      return 20 - grid.getSandHeight(0, 0)!
    }

    const coarse = slumpedOver(0.05, 4)
    const fine = slumpedOver(0.05, 8)

    expect(coarse).toBeGreaterThan(0)
    expect(fine / coarse).toBeLessThanOrEqual(1)
    expect(fine / coarse).toBeGreaterThan(0.85)
  })

  it('a long step settles toward the repose angle instead of overshooting past it', () => {
    // Scaling the transfer by dt is unstable for a large enough dt: the pair's
    // height difference falls by twice what moves, so past a fraction of a half
    // the step jumps over the repose slope and lands steeper the other way, and
    // the next step throws it back harder.  A sim that stalls and catches up with
    // one long step must settle, not detonate.
    const grid = makeGrid(8, 1)
    grid.setSandHeight(0, 0, 20)
    const slope = new Slope(8, 1)

    for (let i = 0; i < 5; i++) slope.step(grid, 30)

    // Sand ran downhill, and never so far downhill that the foot of the slope
    // ended up above its source.
    expect(grid.getSandHeight(1, 0)!).toBeGreaterThan(0)
    expect(grid.getSandHeight(1, 0)!).toBeLessThanOrEqual(grid.getSandHeight(0, 0)!)
  })

  it('tall sand column collapses toward flat neighbour', () => {
    const grid = makeGrid()
    grid.setSandHeight(0, 0, 20)
    grid.setSandHeight(1, 0, 0)
    const slope = new Slope(4, 1)

    for (let i = 0; i < 50; i++) slope.step(grid, DT)

    expect(grid.getSandHeight(0, 0)!).toBeLessThan(20)
    expect(grid.getSandHeight(1, 0)!).toBeGreaterThan(0)
  })

  it('conserves total sand volume', () => {
    const grid = makeGrid()
    grid.setSandHeight(0, 0, 20)
    grid.setSandHeight(1, 0, 0)
    const totalBefore =
      (grid.getSandHeight(0, 0) ?? 0) + (grid.getSandHeight(1, 0) ?? 0)
    const slope = new Slope(4, 1)

    for (let i = 0; i < 50; i++) slope.step(grid, DT)

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
    const slope = new Slope(4, 1)

    for (let i = 0; i < 10; i++) slope.step(grid, DT)

    for (let x = 0; x < 4; x++) {
      expect(grid.getSandHeight(x, 0)!).toBeCloseTo(before[x]!, 2)
    }
  })

  it('flat terrain stays flat', () => {
    const grid = makeGrid(4, 4)
    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++) grid.setSandHeight(x, z, 5)
    const slope = new Slope(4, 4)

    for (let i = 0; i < 20; i++) slope.step(grid, DT)

    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++)
        expect(grid.getSandHeight(x, z)!).toBeCloseTo(5, 3)
  })
})

describe('Slope dirty mask', () => {
  it('step returns a Uint8Array with length width*depth', () => {
    const grid = makeGrid(4, 1)
    const slope = new Slope(4, 1)
    const dirty = slope.step(grid, DT)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(4)
  })

  it('a real transfer flags both the source and destination cell', () => {
    const grid = makeGrid()
    grid.setSandHeight(0, 0, 20)
    grid.setSandHeight(1, 0, 0)
    const slope = new Slope(4, 1)

    const dirty = slope.step(grid, DT)

    expect(dirty[0]).toBe(1)
    expect(dirty[1]).toBe(1)
  })

  it('a gentle in-repose slope with no transfer stays all-zero', () => {
    const grid = makeGrid(4, 1)
    grid.setSandHeight(0, 0, 5)
    grid.setSandHeight(1, 0, 4.7)
    grid.setSandHeight(2, 0, 4.4)
    grid.setSandHeight(3, 0, 4.1)
    const slope = new Slope(4, 1)

    const dirty = slope.step(grid, DT)

    expect(Array.from(dirty).every(v => v === 0)).toBe(true)
  })

  it('flat terrain produces an all-zero mask', () => {
    const grid = makeGrid(4, 4)
    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++) grid.setSandHeight(x, z, 5)
    const slope = new Slope(4, 4)

    const dirty = slope.step(grid, DT)

    expect(Array.from(dirty).every(v => v === 0)).toBe(true)
  })
})
