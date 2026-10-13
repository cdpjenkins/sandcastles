import { describe, it, expect } from 'vitest'
import { Moisture, SATURATION_DEPTH, WET_DEPTH, moistureAfterDrySand } from './Moisture.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30

// Sand deeper than WET_DEPTH, so a cell holds its full capacity.
const makeGrid = (w = 4, d = 1) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) {
      g.setRockHeight(x, z, 1)
      g.setSandHeight(x, z, WET_DEPTH * 4)
    }
  return g
}

describe('Moisture', () => {
  it('cell with water gets moisture 1.0', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBeCloseTo(1.0)
  })

  it('dry adjacent cell gains moisture from wet neighbour', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)

    for (let i = 0; i < 10; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(1, 0)!).toBeGreaterThan(0)
  })

  it('cell dries out when water is removed', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)

    for (let i = 0; i < 10; i++) moisture.step(grid, DT)
    grid.setWaterHeight(0, 0, 0)
    for (let i = 0; i < 100; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)!).toBeLessThan(0.8)
  })

  it('moisture stays within [0, 1]', () => {
    const grid = makeGrid(4, 4)
    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++)
        grid.setWaterHeight(x, z, 2)
    const moisture = new Moisture(4, 4)

    for (let i = 0; i < 30; i++) moisture.step(grid, DT)

    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++)
        expect(grid.getMoisture(x, z)!).toBeLessThanOrEqual(1.0)
  })

  it('fully dry grid stays at zero moisture', () => {
    const grid = makeGrid()
    const moisture = new Moisture(4, 1)

    for (let i = 0; i < 10; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBe(0)
  })
})

describe('Moisture absorbs water', () => {
  it('dry sand takes SATURATION_DEPTH from the water above it to saturate', () => {
    const grid = makeGrid()
    const depth = SATURATION_DEPTH * 10
    grid.setWaterHeight(0, 0, depth)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBeCloseTo(depth - SATURATION_DEPTH, 6)
    expect(grid.getMoisture(0, 0)!).toBeCloseTo(1.0)
  })

  it('damp sand takes only what it is short of', () => {
    const grid = makeGrid()
    const depth = SATURATION_DEPTH * 10
    grid.setWaterHeight(0, 0, depth)
    grid.setMoisture(0, 0, 0.75)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBeCloseTo(depth - SATURATION_DEPTH * 0.25, 6)
    expect(grid.getMoisture(0, 0)!).toBeCloseTo(1.0)
  })

  it('saturated sand takes nothing', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 0.5)
    grid.setMoisture(0, 0, 1)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(0.5)
  })

  it('soaks up a film thinner than the shortfall entirely, and is only part wet', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, SATURATION_DEPTH / 4)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(0)
    expect(grid.getMoisture(0, 0)!).toBeCloseTo(0.25)
  })

  it('creates no water: what the column loses the sand holds', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, SATURATION_DEPTH * 0.6)
    grid.setMoisture(0, 0, 0.1)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    const waterLost = SATURATION_DEPTH * 0.6 - grid.getWaterHeight(0, 0)!
    const moistureGained = grid.getMoisture(0, 0)! - 0.1
    expect(waterLost).toBeCloseTo(moistureGained * SATURATION_DEPTH, 6)
  })

  it('saturates exactly, so a wet cell is charged once and not every step', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 0.5)
    grid.setMoisture(0, 0, 0.3)
    const moisture = new Moisture(4, 1)
    moisture.step(grid, DT)
    const afterFirst = grid.getWaterHeight(0, 0)

    const dirty = moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBe(1)
    expect(grid.getWaterHeight(0, 0)).toBe(afterFirst)
    expect(dirty[0]).toBe(0)
  })

  it('settles the sediment of water it soaks up entirely', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, SATURATION_DEPTH / 2)
    grid.setSediment(0, 0, 0.003)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getSediment(0, 0)).toBe(0)
    expect(grid.getSandHeight(0, 0)!).toBeCloseTo(WET_DEPTH * 4 + 0.003, 6)
  })

  it('flags a cell whose water it soaked up entirely', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, SATURATION_DEPTH / 2)
    grid.setMoisture(0, 0, 0.5)
    const moisture = new Moisture(4, 1)

    const dirty = moisture.step(grid, DT)

    expect(dirty[0]).toBe(1)
  })
})

describe('Moisture capacity follows the sand', () => {
  const wetCellOver = (sand: number) => {
    const grid = makeGrid()
    grid.setSandHeight(0, 0, sand)
    grid.setWaterHeight(0, 0, 1)
    return grid
  }

  it('bare rock absorbs nothing, though it still reads as wet', () => {
    const grid = wetCellOver(0)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(1)
    expect(grid.getMoisture(0, 0)).toBe(1)
  })

  it('thin sand holds in proportion to its depth', () => {
    const grid = wetCellOver(WET_DEPTH / 4)
    const moisture = new Moisture(4, 1)

    moisture.step(grid, DT)

    expect(1 - grid.getWaterHeight(0, 0)!).toBeCloseTo(SATURATION_DEPTH / 4, 6)
    expect(grid.getMoisture(0, 0)!).toBeCloseTo(1.0)
  })

  it('sand deeper than WET_DEPTH holds no more than WET_DEPTH does', () => {
    const atDepth = wetCellOver(WET_DEPTH)
    const deeper = wetCellOver(WET_DEPTH * 10)
    const moisture = new Moisture(4, 1)

    moisture.step(atDepth, DT)
    moisture.step(deeper, DT)

    expect(1 - atDepth.getWaterHeight(0, 0)!).toBeCloseTo(SATURATION_DEPTH, 6)
    expect(deeper.getWaterHeight(0, 0)).toBe(atDepth.getWaterHeight(0, 0))
  })

  it('a film over thin sand wets it further than over deep sand', () => {
    const thin = makeGrid()
    thin.setSandHeight(0, 0, WET_DEPTH / 2)
    thin.setWaterHeight(0, 0, SATURATION_DEPTH / 4)
    const deep = makeGrid()
    deep.setWaterHeight(0, 0, SATURATION_DEPTH / 4)
    const moisture = new Moisture(4, 1)

    moisture.step(thin, DT)
    moisture.step(deep, DT)

    expect(thin.getMoisture(0, 0)!).toBeCloseTo(0.5)
    expect(deep.getMoisture(0, 0)!).toBeCloseTo(0.25)
  })
})

describe('moistureAfterDrySand', () => {
  it('a full wetting layer of dry sand leaves the surface dry', () => {
    expect(moistureAfterDrySand(1, WET_DEPTH * 5, WET_DEPTH)).toBe(0)
    expect(moistureAfterDrySand(1, WET_DEPTH * 5, WET_DEPTH * 10)).toBe(0)
  })

  it('a thin dry layer mixes with the damp sand still within the wetting depth', () => {
    // A quarter-layer of dry sand on deep, saturated sand: the top WET_DEPTH
    // is now a quarter dry and three quarters the old damp sand.
    expect(moistureAfterDrySand(1, WET_DEPTH * 5, WET_DEPTH / 4)).toBeCloseTo(0.75)
    expect(moistureAfterDrySand(0.4, WET_DEPTH * 5, WET_DEPTH / 4)).toBeCloseTo(0.3)
  })

  it('on thin damp sand the layer mixes in proportion to both amounts', () => {
    // A quarter-layer of damp sand under a quarter-layer of dry: half and half.
    expect(moistureAfterDrySand(0.8, WET_DEPTH / 4, WET_DEPTH / 4)).toBeCloseTo(0.4)
  })

  it('dry sand on bare rock is dry, however wet the rock was', () => {
    expect(moistureAfterDrySand(1, 0, WET_DEPTH / 4)).toBe(0)
  })

  it('adding nothing changes nothing', () => {
    expect(moistureAfterDrySand(0.6, WET_DEPTH * 5, 0)).toBe(0.6)
    expect(moistureAfterDrySand(0.6, 0, 0)).toBe(0.6)
  })
})

describe('Moisture dirty mask', () => {
  it('step returns a Uint8Array with length width*depth', () => {
    const grid = makeGrid(4, 1)
    const moisture = new Moisture(4, 1)
    const dirty = moisture.step(grid, DT)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(4)
  })

  it('a cell going wet for the first time is flagged dirty', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)

    const dirty = moisture.step(grid, DT)

    expect(dirty[0]).toBe(1)
  })

  it('a wet cell already at moisture 1.0 is not re-flagged dirty', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)
    moisture.step(grid, DT)

    const dirty = moisture.step(grid, DT)

    expect(dirty[0]).toBe(0)
  })

  it('an isolated dry cell that stays at zero moisture is not dirty', () => {
    const grid = makeGrid()
    const moisture = new Moisture(4, 1)

    const dirty = moisture.step(grid, DT)

    expect(dirty[3]).toBe(0)
  })

  it('a dry neighbour that actually gains moisture is flagged on the tick it changes', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)

    let dirty = moisture.step(grid, DT)
    // Cell 1 sits adjacent to the wet source; it should pick up moisture
    // well before it converges, and be flagged on that tick.
    for (let i = 0; i < 20 && dirty[1] === 0; i++) {
      dirty = moisture.step(grid, DT)
    }

    expect(dirty[1]).toBe(1)
  })
})
