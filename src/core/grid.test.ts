import { describe, it, expect } from 'vitest'
import { Grid } from './Grid.ts'
import type { BeachSea } from './BeachSea.ts'

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

  it('exposes seaStart as the single source of truth for the sea boundary', () => {
    const grid = new Grid(128, 256)
    expect(grid.seaStart).toBe(Math.floor(256 * 0.78))
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

  it('surface height is rock + sand', () => {
    const grid = new Grid(16, 16)
    grid.setSandHeight(5, 5, 3.0)
    grid.setRockHeight(5, 5, 1.0)
    expect(grid.getSurfaceHeight(5, 5)).toBeCloseTo(4.0)
  })

  it('water surface height is the elevation of the water top, not its depth', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1.0)
    grid.setSandHeight(5, 5, 3.0)
    grid.setWaterHeight(5, 5, 0.75)

    expect(grid.getWaterSurfaceHeight(5, 5)).toBeCloseTo(4.75)
  })

  it('a dry cell has its bed elevation as its water surface height', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1.0)
    grid.setSandHeight(5, 5, 3.0)

    expect(grid.getWaterSurfaceHeight(5, 5)).toBeCloseTo(4.0)
  })

  it('getWaterSurfaceHeight returns undefined out of bounds', () => {
    const grid = new Grid(16, 16)

    expect(grid.getWaterSurfaceHeight(-1, 5)).toBeUndefined()
    expect(grid.getWaterSurfaceHeight(16, 5)).toBeUndefined()
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

  it('restores the sand height it was snapshotted with', () => {
    const grid = new Grid(4, 4)
    grid.setSandHeight(1, 2, 7.5)

    const snapshot = grid.snapshot()
    grid.setSandHeight(1, 2, 0)
    grid.restore(snapshot)

    expect(grid.getSandHeight(1, 2)).toBe(7.5)
  })

  it('restores every layer of grid state, not just sand', () => {
    const grid = new Grid(4, 4)
    grid.setRockHeight(1, 1, 3)
    grid.setSandHeight(1, 1, 4)
    grid.setWaterHeight(1, 1, 5)
    grid.setMoisture(1, 1, 0.5)
    grid.setSourceRate(1, 1, 2)
    grid.setSediment(1, 1, 0.25)

    const snapshot = grid.snapshot()
    grid.setRockHeight(1, 1, 0)
    grid.setSandHeight(1, 1, 0)
    grid.setWaterHeight(1, 1, 0)
    grid.setMoisture(1, 1, 0)
    grid.setSourceRate(1, 1, 0)
    grid.setSediment(1, 1, 0)
    grid.restore(snapshot)

    expect(grid.getRockHeight(1, 1)).toBe(3)
    expect(grid.getSandHeight(1, 1)).toBe(4)
    expect(grid.getWaterHeight(1, 1)).toBe(5)
    expect(grid.getMoisture(1, 1)).toBe(0.5)
    expect(grid.getSourceRate(1, 1)).toBe(2)
    expect(grid.getSediment(1, 1)).toBe(0.25)
  })

  it('takes a copy, so the running simulation cannot alter a snapshot already taken', () => {
    const grid = new Grid(4, 4)
    grid.setSandHeight(2, 2, 1)

    const snapshot = grid.snapshot()
    grid.setSandHeight(2, 2, 99)

    expect(snapshot.sand[2 * 4 + 2]).toBe(1)
  })

  it('restores through a copy, so later digging does not corrupt the snapshot', () => {
    const grid = new Grid(4, 4)
    grid.setSandHeight(2, 2, 1)
    const snapshot = grid.snapshot()

    grid.restore(snapshot)
    grid.setSandHeight(2, 2, 99)

    expect(snapshot.sand[2 * 4 + 2]).toBe(1)
  })
})

// The sea is a value per beach: a generator sets it, the sim reads it every
// step. A grid built without a generator keeps the sea every beach has had.
const SEA: BeachSea = {
  seaStart: 10,
  seaLevel: 3.5,
  tideAmplitude: 0.4,
  tidePeriod: 240,
  swellFrequency: 0.8,
  swellStrength: 0.5,
}

describe('The sea', () => {
  it('defaults to the sea every beach has had', () => {
    const grid = new Grid(256, 256)

    expect(grid.sea).toEqual({
      seaStart: 199,
      seaLevel: 2,
      tideAmplitude: 0.8,
      tidePeriod: 180,
      swellFrequency: 1,
      swellStrength: 1,
    })
  })

  it('is set whole by whatever lays out the beach', () => {
    const grid = new Grid(16, 16)

    grid.setSea(SEA)

    expect(grid.sea).toEqual(SEA)
    expect(grid.seaStart).toBe(10)
    expect(grid.seaLevel).toBe(3.5)
  })

  it('is not changed by changing the object it was set from', () => {
    const grid = new Grid(16, 16)
    const sea = { ...SEA }
    grid.setSea(sea)

    sea.seaLevel = 9

    expect(grid.seaLevel).toBe(3.5)
  })

  // The sea is restored alongside the layers, by applySnapshot, not with them:
  // GridSnapshot is the cell layers and nothing else.
  it('is not carried by the layers snapshot', () => {
    const source = new Grid(16, 16)
    source.setSea(SEA)
    const target = new Grid(16, 16)

    target.restore(source.snapshot())

    expect(target.sea).toEqual(new Grid(16, 16).sea)
  })

  it('refuses a sea that starts off the grid or between rows', () => {
    const grid = new Grid(16, 16)

    expect(() => grid.setSea({ ...SEA, seaStart: 0 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, seaStart: 16 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, seaStart: 10.5 })).toThrow(RangeError)
  })

  it('refuses a sea level that is not a number', () => {
    const grid = new Grid(16, 16)

    expect(() => grid.setSea({ ...SEA, seaLevel: NaN })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, seaLevel: Infinity })).toThrow(RangeError)
  })

  it('refuses a tide with a negative amplitude or no period', () => {
    const grid = new Grid(16, 16)

    expect(() => grid.setSea({ ...SEA, tideAmplitude: -0.1 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, tideAmplitude: NaN })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, tidePeriod: 0 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, tidePeriod: Infinity })).toThrow(RangeError)
  })

  it('takes a tide that does not move', () => {
    const grid = new Grid(16, 16)

    grid.setSea({ ...SEA, tideAmplitude: 0 })

    expect(grid.sea.tideAmplitude).toBe(0)
  })

  // The swell is a fraction of the harshest swell anything was tuned with.
  it('refuses a swell harsher than the maximum, or with no frequency', () => {
    const grid = new Grid(16, 16)

    expect(() => grid.setSea({ ...SEA, swellFrequency: 0 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, swellFrequency: 1.01 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, swellStrength: -0.1 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, swellStrength: 1.01 })).toThrow(RangeError)
    expect(() => grid.setSea({ ...SEA, swellStrength: NaN })).toThrow(RangeError)
  })

  it('takes a flat sea', () => {
    const grid = new Grid(16, 16)

    grid.setSea({ ...SEA, swellStrength: 0 })

    expect(grid.sea.swellStrength).toBe(0)
  })

  it('is left as it was by a refused change', () => {
    const grid = new Grid(16, 16)
    grid.setSea(SEA)

    expect(() => grid.setSea({ ...SEA, seaLevel: 1, swellFrequency: 2 })).toThrow()

    expect(grid.sea).toEqual(SEA)
  })
})
