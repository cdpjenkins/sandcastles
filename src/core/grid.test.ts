import { describe, it, expect } from 'vitest'
import { Grid } from './Grid.ts'

describe('Grid', () => {
  it('getTotalSandHeight sums sand height across the whole grid', () => {
    const grid = new Grid(4, 4)
    grid.setSandHeight(0, 0, 2)
    grid.setSandHeight(1, 2, 3.5)
    grid.setSandHeight(3, 3, 1.25)
    expect(grid.getTotalSandHeight()).toBeCloseTo(6.75)
  })

  it('getTotalSandHeight is zero for a fresh grid', () => {
    const grid = new Grid(8, 8)
    expect(grid.getTotalSandHeight()).toBe(0)
  })

  it('has the correct dimensions', () => {
    const grid = new Grid(256, 256)
    expect(grid.width).toBe(256)
    expect(grid.depth).toBe(256)
  })

  it('initialises beach with positive average sand height inland', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    let sum = 0
    for (let x = 0; x < 256; x++) sum += grid.getSandHeight(x, 0)!
    expect(sum / 256).toBeGreaterThan(0)
  })

  it('sea strip at far edge has zero sand height', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    expect(grid.getSandHeight(128, 255)).toBe(0)
  })

  it('exposes seaStart as the single source of truth for the sea boundary', () => {
    const grid = new Grid(128, 256)
    expect(grid.seaStart).toBe(Math.floor(256 * 0.78))
  })

  it('initBeach places the sand/sea boundary exactly at seaStart', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()

    let maxJustBeforeSea = 0
    for (let x = 0; x < 256; x++) {
      maxJustBeforeSea = Math.max(maxJustBeforeSea, grid.getSandHeight(x, grid.seaStart - 1)!)
      expect(grid.getSandHeight(x, grid.seaStart)).toBe(0)
    }
    expect(maxJustBeforeSea).toBeGreaterThan(0)
  })

  it('back row average sand height is modest (much less than 15)', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    let sum = 0
    for (let x = 0; x < 256; x++) sum += grid.getSandHeight(x, 0)!
    expect(sum / 256).toBeLessThan(15)
  })

  it('sand height decreases toward sea edge', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const highGround = grid.getSandHeight(128, 0)!
    const lowGround = grid.getSandHeight(128, 200)!
    expect(highGround).toBeGreaterThan(lowGround)
  })

  it('back row minimum sand height is above sea level', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    let min = Infinity
    for (let x = 0; x < 256; x++) min = Math.min(min, grid.getSandHeight(x, 0)!)
    expect(min).toBeGreaterThan(1)
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
    expect(variance).toBeGreaterThan(2)
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

  it('terrain noise is smooth (low average cell-to-cell step inland)', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    let sum = 0
    for (let x = 0; x < 255; x++)
      sum += Math.abs(grid.getSandHeight(x + 1, 10)! - grid.getSandHeight(x, 10)!)
    expect(sum / 255).toBeLessThan(0.23)
  })

  it('beach has fractal height variation across cells at the same depth', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const heights = new Set<number>()
    for (let x = 0; x < 64; x++) heights.add(grid.getSandHeight(x, 50)!)
    expect(heights.size).toBeGreaterThan(32)
  })

  it('rock height has fractal variation across land cells at the same depth', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const heights = new Set<number>()
    for (let x = 0; x < 64; x++) heights.add(grid.getRockHeight(x, 50)!)
    expect(heights.size).toBeGreaterThan(32)
  })

  it('rock height starts at 0 at seaStart and slopes to -20 at the far edge', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    for (let x = 0; x < 256; x += 16) {
      expect(grid.getRockHeight(x, grid.seaStart)).toBeCloseTo(0)
      expect(grid.getRockHeight(x, grid.depth - 1)).toBeCloseTo(-20)
    }
  })

  it('rock height varies linearly across the sea floor', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const x = 128
    const midZ = Math.round((grid.seaStart + (grid.depth - 1)) / 2)
    const expectedMid = -20 * ((midZ - grid.seaStart) / ((grid.depth - 1) - grid.seaStart))
    expect(grid.getRockHeight(x, midZ)).toBeCloseTo(expectedMid, 1)
  })

  it('sea water surface stays flat at seaLevel despite the sloped sea floor', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    for (let z = grid.seaStart; z < grid.depth; z += 16) {
      const surface = grid.getSurfaceHeight(128, z)! + grid.getWaterHeight(128, z)!
      expect(surface).toBeCloseTo(grid.seaLevel)
    }
  })

  it('rock height decreases toward the sea edge, like sand', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const highGround = grid.getRockHeight(128, 0)!
    const lowGround = grid.getRockHeight(128, 200)!
    expect(highGround).toBeGreaterThan(lowGround)
  })

  it('rock height stays close to the sea floor immediately next to seaStart', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const z = grid.seaStart - 1
    let max = -Infinity
    for (let x = 0; x < 256; x++) {
      max = Math.max(max, grid.getRockHeight(x, z)!)
    }
    expect(max).toBeLessThan(2.0)
  })

  it('rock height still has full bumpiness 25 units from seaStart', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const z = grid.seaStart - 25
    let max = -Infinity
    for (let x = 0; x < 256; x++) {
      max = Math.max(max, grid.getRockHeight(x, z)!)
    }
    expect(max).toBeGreaterThan(4.0)
  })

  it('rock height inland has substantial fractal bumpiness', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
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

  it('rock height on land is always positive (immovable base)', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    for (let z = 0; z < grid.seaStart; z += 32) {
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

  it('exposes seaLevel as the sea surface height', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    const seaSurface = grid.getSurfaceHeight(128, grid.seaStart)! + grid.getWaterHeight(128, grid.seaStart)!
    expect(grid.seaLevel).toBeCloseTo(seaSurface)
  })

  it('land below sea level starts inundated with water up to sea level', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
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

  it('initSpring places a single water source, centred in x and well inland', () => {
    const grid = new Grid(256, 256)
    grid.initSpring(3.0)

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
