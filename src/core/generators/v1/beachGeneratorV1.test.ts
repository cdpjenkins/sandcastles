import { describe, it, expect } from 'vitest'
import { Grid } from '../../Grid.ts'
import { layBeachV1, placeClassicSpringV1 } from './BeachGeneratorV1.ts'

describe('The v1 beach', () => {
  it('initialises beach with positive average sand height inland', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let sum = 0
    for (let x = 0; x < 256; x++) sum += grid.getSandHeight(x, 0)!
    expect(sum / 256).toBeGreaterThan(0)
  })

  it('sea strip at far edge has zero sand height', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    expect(grid.getSandHeight(128, 255)).toBe(0)
  })

  it('layBeachV1 places the sand/sea boundary exactly at seaStart', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)

    let maxJustBeforeSea = 0
    for (let x = 0; x < 256; x++) {
      maxJustBeforeSea = Math.max(maxJustBeforeSea, grid.getSandHeight(x, grid.seaStart - 1)!)
      expect(grid.getSandHeight(x, grid.seaStart)).toBe(0)
    }
    expect(maxJustBeforeSea).toBeGreaterThan(0)
  })

  it('back row average sand height is modest (much less than 15)', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let sum = 0
    for (let x = 0; x < 256; x++) sum += grid.getSandHeight(x, 0)!
    expect(sum / 256).toBeLessThan(15)
  })

  it('sand height decreases toward sea edge', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const highGround = grid.getSandHeight(128, 0)!
    const lowGround = grid.getSandHeight(128, 200)!
    expect(highGround).toBeGreaterThan(lowGround)
  })

  it('back row minimum sand height is above sea level', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let min = Infinity
    for (let x = 0; x < 256; x++) min = Math.min(min, grid.getSandHeight(x, 0)!)
    expect(min).toBeGreaterThan(1)
  })

  it('inland row has high height variance (bumpy terrain)', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let sum = 0
    let sumSq = 0
    const N = 256
    for (let x = 0; x < N; x++) {
      const h = grid.getSandHeight(x, 10)!
      sum += h
      sumSq += h * h
    }
    const variance = sumSq / N - (sum / N) ** 2
    expect(variance).toBeGreaterThan(2)
  })

  it('inland terrain is bumpier than near-shore terrain', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
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
    layBeachV1(grid)
    const avgDrop = (z: number) => {
      let sum = 0
      for (let x = 0; x < 256; x += 16)
        sum += Math.abs((grid.getSandHeight(x, z)! - grid.getSandHeight(x, z + 1)!))
      return sum / 16
    }
    expect(avgDrop(20)).toBeGreaterThan(avgDrop(170))
  })

  it('terrain noise is smooth (low average cell-to-cell step inland)', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let sum = 0
    for (let x = 0; x < 255; x++)
      sum += Math.abs(grid.getSandHeight(x + 1, 10)! - grid.getSandHeight(x, 10)!)
    expect(sum / 255).toBeLessThan(0.23)
  })

  it('beach has fractal height variation across cells at the same depth', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const heights = new Set<number>()
    for (let x = 0; x < 64; x++) heights.add(grid.getSandHeight(x, 50)!)
    expect(heights.size).toBeGreaterThan(32)
  })

  it('rock height has fractal variation across land cells at the same depth', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const heights = new Set<number>()
    for (let x = 0; x < 64; x++) heights.add(grid.getRockHeight(x, 50)!)
    expect(heights.size).toBeGreaterThan(32)
  })

  it('rock height starts at 0 at seaStart and slopes to -20 at the far edge', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    for (let x = 0; x < 256; x += 16) {
      expect(grid.getRockHeight(x, grid.seaStart)).toBeCloseTo(0)
      expect(grid.getRockHeight(x, grid.depth - 1)).toBeCloseTo(-20)
    }
  })

  it('rock height varies linearly across the sea floor', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const x = 128
    const midZ = Math.round((grid.seaStart + (grid.depth - 1)) / 2)
    const expectedMid = -20 * ((midZ - grid.seaStart) / ((grid.depth - 1) - grid.seaStart))
    expect(grid.getRockHeight(x, midZ)).toBeCloseTo(expectedMid, 1)
  })

  it('sea water surface stays flat at seaLevel despite the sloped sea floor', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    for (let z = grid.seaStart; z < grid.depth; z += 16) {
      expect(grid.getWaterSurfaceHeight(128, z)).toBeCloseTo(grid.seaLevel)
    }
  })

  it('rock height decreases toward the sea edge, like sand', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const highGround = grid.getRockHeight(128, 0)!
    const lowGround = grid.getRockHeight(128, 200)!
    expect(highGround).toBeGreaterThan(lowGround)
  })

  it('rock height blends down to meet the sea floor height immediately next to seaStart', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const z = grid.seaStart - 1
    for (let x = 0; x < 256; x++) {
      expect(Math.abs(grid.getRockHeight(x, z)!)).toBeLessThan(1.0)
    }
  })

  it('rock height still has full bumpiness 25 units from seaStart', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const z = grid.seaStart - 25
    let max = -Infinity
    for (let x = 0; x < 256; x++) {
      max = Math.max(max, grid.getRockHeight(x, z)!)
    }
    expect(max).toBeGreaterThan(4.0)
  })

  it('sand height blends down to zero immediately next to seaStart', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const z = grid.seaStart - 1
    for (let x = 0; x < 256; x++) {
      expect(grid.getSandHeight(x, z)!).toBeLessThan(0.5)
    }
  })

  it('sand height still has full noise 25 units from seaStart', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const z = grid.seaStart - 25
    let max = -Infinity
    for (let x = 0; x < 256; x++) {
      max = Math.max(max, grid.getSandHeight(x, z)!)
    }
    expect(max).toBeGreaterThan(1.5)
  })

  it('rock height inland has substantial fractal bumpiness', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let sum = 0
    let sumSq = 0
    const N = 256
    for (let x = 0; x < N; x++) {
      const h = grid.getRockHeight(x, 10)!
      sum += h
      sumSq += h * h
    }
    const variance = sumSq / N - (sum / N) ** 2
    expect(variance).toBeGreaterThan(7)
  })

  it('rock height on land away from the shore is always positive (immovable base)', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    for (let z = 0; z < grid.seaStart - 25; z += 32) {
      for (let x = 0; x < 256; x += 32) {
        expect(grid.getRockHeight(x, z)).toBeGreaterThan(0)
      }
    }
  })

  it('exposes seaLevel as the sea surface height', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const seaSurface = grid.getSurfaceHeight(128, grid.seaStart)! + grid.getWaterHeight(128, grid.seaStart)!
    expect(grid.seaLevel).toBeCloseTo(seaSurface)
  })

  it('land below sea level starts inundated with water up to sea level', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    let foundSubmerged = false
    for (let z = 0; z < grid.seaStart; z++) {
      for (let x = 0; x < grid.width; x++) {
        const surface = grid.getSurfaceHeight(x, z)!
        const water = grid.getWaterHeight(x, z)!
        if (surface < grid.seaLevel - 1e-6) {
          foundSubmerged = true
          expect(surface + water).toBeCloseTo(grid.seaLevel, 5)
        } else {
          expect(water).toBe(0)
        }
      }
    }
    expect(foundSubmerged).toBe(true)
  })

  it('placeClassicSpringV1 places a single water source, centred in x and well inland', () => {
    const grid = new Grid(256, 256)
    placeClassicSpringV1(grid, 3.0)

    let sourceCount = 0
    let sourceX = -1
    let sourceZ = -1
    for (let z = 0; z < grid.depth; z++) {
      for (let x = 0; x < grid.width; x++) {
        if ((grid.getSourceRate(x, z) ?? 0) > 0) {
          sourceCount++
          sourceX = x
          sourceZ = z
        }
      }
    }

    expect(sourceCount).toBe(1)
    expect(sourceX).toBe(Math.floor(grid.width / 2))
    expect(grid.getSourceRate(sourceX, sourceZ)).toBeCloseTo(3.0)
    expect(sourceZ).toBeLessThan(grid.seaStart * 0.25)
  })
})

// FNV-1a over the layer's raw bytes: bit-exact, so a change in the last place of
// one cell shows.
const layerChecksum = (layer: Float32Array): string => {
  const bytes = new Uint8Array(layer.buffer, layer.byteOffset, layer.byteLength)
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

describe('The classic beach', () => {
  // Every game so far has started on this beach and every scene in CLAUDE.md
  // was tuned on it, so seeding the generator must leave it bit-for-bit alone.
  // Pinned before the generator was touched. If this fails, the classic beach
  // has changed - not the test.
  it('generates the same rock and sand it always has', () => {
    const grid = new Grid(256, 256)
    layBeachV1(grid)
    const { rock, sand } = grid.snapshot()

    expect(layerChecksum(rock)).toBe('e06ca45c')
    expect(layerChecksum(sand)).toBe('cdf8f2eb')
  })
})

describe('A seeded beach', () => {
  const beach = (seed?: number) => {
    const grid = new Grid(256, 256)
    layBeachV1(grid, seed)
    return grid.snapshot()
  }

  it('is the classic beach at seed 0', () => {
    const { rock, sand } = beach(0)
    expect(layerChecksum(rock)).toBe('e06ca45c')
    expect(layerChecksum(sand)).toBe('cdf8f2eb')
  })

  it('is the same beach every time for the same seed', () => {
    const a = beach(12345)
    const b = beach(12345)
    expect(layerChecksum(a.rock)).toBe(layerChecksum(b.rock))
    expect(layerChecksum(a.sand)).toBe(layerChecksum(b.sand))
  })

  it('differs from the classic beach in both rock and sand', () => {
    const classic = beach(0)
    const seeded = beach(12345)
    expect(layerChecksum(seeded.rock)).not.toBe(layerChecksum(classic.rock))
    expect(layerChecksum(seeded.sand)).not.toBe(layerChecksum(classic.sand))
  })

  it('differs between two seeds', () => {
    expect(layerChecksum(beach(1).sand)).not.toBe(layerChecksum(beach(2).sand))
  })

  // Only the land's noise is seeded: the sea bed and the water over it are the
  // same on every beach.
  it('leaves the sea the same on every seed', () => {
    const grid = new Grid(256, 256)
    const seaFrom = grid.seaStart * 256
    const classic = beach(0)
    const seeded = beach(12345)
    for (const layer of ['rock', 'sand', 'water'] as const) {
      expect(layerChecksum(seeded[layer].subarray(seaFrom)))
        .toBe(layerChecksum(classic[layer].subarray(seaFrom)))
    }
  })
})
