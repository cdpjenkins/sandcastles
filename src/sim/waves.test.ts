import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Grid } from '../core/Grid.ts'
import { layBeachV1 } from '../core/generators/v1/BeachGeneratorV1.ts'

const DT = 1 / 30
// Small grid: width=4, depth=8, seaZ=6 (mimics depth*0.75)
const SEA_Z = 6
// Waves drives only the outermost row, as an open boundary; everything inshore
// of it is left to the water sim.
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

// The boundary oscillates with the swell rather than sitting still, so the tide
// shows up in the mean over a whole swell period, not in any single sample.
const meanBoundaryDepthOverAPeriod = (seaSurface: number): number => {
  const grid = makeGrid()
  const waves = new Waves(4, 8)
  const steps = Math.round(waves.period(grid) / DT)
  let sum = 0
  for (let i = 0; i < steps; i++) {
    waves.step(grid, DT, seaSurface)
    sum += grid.getWaterHeight(0, BOUNDARY_Z)!
  }
  return sum / steps
}

describe('Waves', () => {
  it('oscillates the boundary row about the sea level', () => {
    expect(meanBoundaryDepthOverAPeriod(SEA_SURFACE)).toBeCloseTo(SEA_DEPTH, 1)
  })

  it('carries the boundary row up to meet a higher sea level', () => {
    expect(meanBoundaryDepthOverAPeriod(SEA_SURFACE + 0.4)).toBeCloseTo(SEA_DEPTH + 0.4, 1)
  })

  it('carries the boundary row down to meet a lower sea level', () => {
    expect(meanBoundaryDepthOverAPeriod(SEA_SURFACE - 0.4)).toBeCloseTo(SEA_DEPTH - 0.4, 1)
  })

  it('drives the boundary row regardless of what was there before', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, BOUNDARY_Z, 99)
    const waves = new Waves(4, 8)

    waves.step(grid, DT, SEA_SURFACE)

    expect(grid.getWaterHeight(0, BOUNDARY_Z)!).toBeLessThan(SEA_DEPTH + 1)
  })

  it('a sea cell inshore of the boundary is left for the water sim to move', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, SEA_Z, 99)
    const waves = new Waves(4, 8)

    waves.step(grid, DT, SEA_SURFACE)

    expect(grid.getWaterHeight(0, SEA_Z)!).toBe(99)
  })

  it('timeUntilWave counts down', () => {
    const waves = new Waves(4, 8)
    const before = waves.timeUntilWave
    waves.step(new Grid(4, 8), DT, SEA_SURFACE)
    expect(waves.timeUntilWave).toBeLessThan(before)
  })

  it('timer resets after a crest passes', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    const steps = Math.ceil(waves.period(grid) / DT) + 1
    for (let i = 0; i < steps; i++) waves.step(grid, DT, SEA_SURFACE)

    expect(waves.timeUntilWave).toBeCloseTo(waves.period(grid), 0)
  })
})

// The beach's swell is a fraction of the harshest one anything was tuned with:
// a lower frequency is a longer period, a lower strength a smaller wave.
const withSwell = (swellFrequency: number, swellStrength: number): Grid => {
  const grid = makeGrid()
  grid.setSea({ ...grid.sea, swellFrequency, swellStrength })
  return grid
}

describe("Waves on a beach's own swell", () => {
  it('has the full period at full frequency, and a longer one below it', () => {
    const waves = new Waves(4, 8)
    const full = waves.period(withSwell(1, 1))

    expect(waves.period(withSwell(0.8, 1))).toBeCloseTo(full / 0.8, 5)
  })

  it("counts down to the next wave against the beach's period", () => {
    const grid = withSwell(0.8, 1)
    const waves = new Waves(4, 8)
    do waves.step(grid, DT, SEA_SURFACE)
    while (!waves.fired)

    expect(waves.timeUntilWave).toBeGreaterThan(waves.period(grid) - DT)
    expect(waves.timeUntilWave).toBeLessThanOrEqual(waves.period(grid))
  })

  it("puts a half-strength swell's surface half as far from the sea's", () => {
    const waves = new Waves(4, 8)
    waves.step(makeGrid(), 0.7, SEA_SURFACE)

    for (const [x, z] of [[0, 7], [3, 7], [2, 5]] as const) {
      const full = waves.surfaceAt(withSwell(1, 1), x, z, SEA_SURFACE) - SEA_SURFACE
      const half = waves.surfaceAt(withSwell(1, 0.5), x, z, SEA_SURFACE) - SEA_SURFACE
      expect(Math.abs(full)).toBeGreaterThan(0.01)
      expect(half).toBeCloseTo(full / 2, 5)
    }
  })

  it('leaves the sea flat at no strength', () => {
    const waves = new Waves(4, 8)
    waves.step(makeGrid(), 0.7, SEA_SURFACE)

    expect(waves.surfaceAt(withSwell(1, 0), 0, 7, SEA_SURFACE)).toBe(SEA_SURFACE)
  })
})

describe('Waves on the real beach', () => {
  it('leaves a disturbance in the open sea alone', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const waves = new Waves(grid.width, grid.depth)
    const x = 128
    const z = 230
    const before = grid.getWaterHeight(x, z)!

    grid.setWaterHeight(x, z, before + 2)
    waves.step(grid, DT, grid.seaLevel)

    expect(grid.getWaterHeight(x, z)!).toBeGreaterThan(before + 1)
  })

  it('derives the boundary depth from the bed it sits on', () => {
    // The sea floor is at -20 out here.  Treating sea level as a depth rather
    // than an elevation would put the surface at -18; this is the regression
    // guard for that, now that the boundary tracks the swell.
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const waves = new Waves(grid.width, grid.depth)
    const x = 128
    const z = grid.depth - 1

    waves.step(grid, DT, grid.seaLevel)

    const surface = grid.getSurfaceHeight(x, z)! + grid.getWaterHeight(x, z)!
    expect(surface).toBeCloseTo(waves.surfaceAt(grid, x, z, grid.seaLevel), 5)
  })

  it('leaves the sea surface flat at seaLevel inshore of the boundary', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const waves = new Waves(grid.width, grid.depth)
    const x = 128

    waves.step(grid, DT, grid.seaLevel)

    for (let z = grid.seaStart; z < grid.depth - 1; z++) {
      const surface = grid.getSurfaceHeight(x, z)! + grid.getWaterHeight(x, z)!
      expect(surface).toBeCloseTo(grid.seaLevel, 5)
    }
  })
})

describe('Waves dirty mask', () => {
  it('step returns a Uint8Array with length width*depth', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)
    const dirty = waves.step(grid, DT, SEA_SURFACE)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(32)
  })

  it('flags the boundary cell as the swell moves it', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, DT, SEA_SURFACE)

    expect(dirty[BOUNDARY_Z * 4]).toBe(1)
  })

  it('leaves cells inshore of the boundary unflagged', () => {
    const grid = makeGrid()
    const waves = new Waves(4, 8)

    const dirty = waves.step(grid, DT, SEA_SURFACE)

    expect(dirty[SEA_Z * 4]).toBe(0)
  })
})

describe('Waves snapshot', () => {
  it('restores the swell phase it was snapshotted with', () => {
    const grid = new Grid(16, 16)
    layBeachV1(grid)
    const waves = new Waves(16, 16)
    for (let i = 0; i < 20; i++) waves.step(grid, 1 / 30, 2)

    const restored = new Waves(16, 16)
    restored.restore(waves.snapshot())

    expect(restored.surfaceAt(grid, 4, 15, 2)).toBeCloseTo(waves.surfaceAt(grid, 4, 15, 2))
  })

  it('restores the countdown to the next wave', () => {
    const grid = new Grid(16, 16)
    layBeachV1(grid)
    const waves = new Waves(16, 16)
    for (let i = 0; i < 20; i++) waves.step(grid, 1 / 30, 2)

    const restored = new Waves(16, 16)
    restored.restore(waves.snapshot())

    expect(restored.timeUntilWave).toBeCloseTo(waves.timeUntilWave)
  })
})
