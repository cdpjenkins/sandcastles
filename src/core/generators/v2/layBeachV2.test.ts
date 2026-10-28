import { describe, it, expect } from 'vitest'
import { Grid } from '../../Grid.ts'
import { layBeachV2 } from './BeachGeneratorV2.ts'
import { layBeachV1 } from '../v1/BeachGeneratorV1.ts'
import type { ShapeV2 } from './ShapeV2.ts'

// v1's land, stated as a shape: every comparison below moves one knob from here.
const V1_LIKE: ShapeV2 = {
  seaFraction: 0.78,
  seaLevel: 2,
  tideAmplitude: 0.8,
  tidePeriod: 180,
  swellFrequency: 1,
  swellStrength: 1,
  beachDrop: 22,
  ridgePower: 2,
  sandShare: 9 / 21,
  noiseScale: 1,
}

const laid = (changes: Partial<ShapeV2>): Grid => {
  const grid = new Grid(256, 256)
  layBeachV2(grid, { ...V1_LIKE, ...changes }, 0)
  return grid
}

// Mean over rows [z0, z1) of the whole width.
const mean = (grid: Grid, z0: number, z1: number, read: (x: number, z: number) => number): number => {
  let sum = 0
  for (let z = z0; z < z1; z++) for (let x = 0; x < grid.width; x++) sum += read(x, z)
  return sum / ((z1 - z0) * grid.width)
}
const surface = (grid: Grid) => (x: number, z: number) => grid.getSurfaceHeight(x, z)!
const sand = (grid: Grid) => (x: number, z: number) => grid.getSandHeight(x, z)!

describe('layBeachV2', () => {
  // With the noise off, the drop is exactly what the shape says: the back of
  // the beach stands beachDrop above the sea's first row.
  it('stands the back of the beach beachDrop above the shore', () => {
    for (const beachDrop of [10, 22, 35]) {
      const grid = laid({ beachDrop, noiseScale: 0 })
      const drop = grid.getSurfaceHeight(128, 0)! - grid.getSurfaceHeight(128, grid.seaStart)!

      expect(drop, `beachDrop ${beachDrop}`).toBeCloseTo(beachDrop, 4)
    }
  })

  it('stands the back of a steep beach higher than a flat one', () => {
    const high = laid({ beachDrop: 35 })
    const low = laid({ beachDrop: 10 })

    expect(mean(high, 0, 20, surface(high))).toBeGreaterThan(mean(low, 0, 20, surface(low)) + 5)
  })

  // A lower power keeps the ridge high further down the beach, so the steep
  // part runs across it rather than sitting at the back.
  it('keeps a low-ridgePower beach higher halfway down', () => {
    const low = laid({ ridgePower: 1.5 })
    const high = laid({ ridgePower: 2.5 })
    const mid = Math.floor(high.seaStart / 2)

    expect(mean(low, mid - 5, mid + 5, surface(low)))
      .toBeGreaterThan(mean(high, mid - 5, mid + 5, surface(high)) + 1)
  })

  it('leaves the back of the beach where it was whatever the power', () => {
    const low = laid({ ridgePower: 1.5 })
    const high = laid({ ridgePower: 2.5 })

    expect(low.getSurfaceHeight(128, 0)).toBeCloseTo(high.getSurfaceHeight(128, 0)!, 4)
  })

  // sandShare moves the ridge between the layers rather than adding to it.
  it('gives a high-sandShare beach deeper sand over a similar surface', () => {
    const sandy = laid({ sandShare: 0.65 })
    const rocky = laid({ sandShare: 0.25 })

    const sandGap = mean(sandy, 0, 40, sand(sandy)) - mean(rocky, 0, 40, sand(rocky))
    const surfaceGap = mean(sandy, 0, 40, surface(sandy)) - mean(rocky, 0, 40, surface(rocky))
    expect(sandGap).toBeGreaterThan(4)
    expect(Math.abs(surfaceGap)).toBeLessThan(sandGap / 4)
  })

})

// How bumpy the land is across the beach: the mean, over a band of rows, of
// each row's spread about its own mean. Read across x, so the ridge falling
// away down the beach does not count.
const bumpiness = (grid: Grid, z0: number, z1: number, read: (x: number, z: number) => number): number => {
  let total = 0
  for (let z = z0; z < z1; z++) {
    let sum = 0
    let squares = 0
    for (let x = 0; x < grid.width; x++) {
      const v = read(x, z)
      sum += v
      squares += v * v
    }
    const m = sum / grid.width
    total += Math.sqrt(Math.max(0, squares / grid.width - m * m))
  }
  return total / (z1 - z0)
}
const rock = (grid: Grid) => (x: number, z: number) => grid.getRockHeight(x, z)!

describe('layBeachV2 noise', () => {
  it('makes a high-noiseScale beach bumpier, in rock and in sand', () => {
    const bold = laid({ noiseScale: 1.6 })
    const plain = laid({ noiseScale: 1 })

    expect(bumpiness(bold, 20, 120, rock(bold))).toBeGreaterThan(1.3 * bumpiness(plain, 20, 120, rock(plain)))
    expect(bumpiness(bold, 20, 120, sand(bold))).toBeGreaterThan(1.3 * bumpiness(plain, 20, 120, sand(plain)))
  })
})

describe('layBeachV2 against v1', () => {
  it("lays v1's land from a shape with v1's knobs", () => {
    const v2 = laid({})
    const v1 = new Grid(256, 256)
    layBeachV1(v1, 0)

    for (let z = 0; z < 256; z += 5) {
      for (let x = 0; x < 256; x += 9) {
        expect(v2.getRockHeight(x, z)).toBeCloseTo(v1.getRockHeight(x, z)!, 4)
        expect(v2.getSandHeight(x, z)).toBeCloseTo(v1.getSandHeight(x, z)!, 4)
      }
    }
  })
})
