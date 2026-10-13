import { describe, it, expect } from 'vitest'
import { Moisture, POROSITY, SOAK_RATE, saturation } from './Moisture.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30
const SAND = 4
const CAPACITY = POROSITY * SAND
// What one step can soak in. Amounts a test means to be soaked whole in a
// single step are stated under this, so SOAK_RATE can be tuned freely.
const STEP_SOAK = SOAK_RATE * DT

const makeGrid = (w = 4, d = 1, sand = SAND) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++) {
      g.setRockHeight(x, z, 1)
      g.setSandHeight(x, z, sand)
    }
  return g
}

const soakFor = (grid: Grid, moisture: Moisture, steps = 300) => {
  for (let i = 0; i < steps; i++) moisture.step(grid, DT)
}

const held = (grid: Grid) => {
  let total = 0
  for (let z = 0; z < grid.depth; z++)
    for (let x = 0; x < grid.width; x++) total += grid.getMoisture(x, z) ?? 0
  return total
}

describe('saturation', () => {
  it('is the water held as a share of what the sand can hold', () => {
    expect(saturation(CAPACITY / 4, SAND, 0)).toBeCloseTo(0.25)
    expect(saturation(CAPACITY, SAND, 0)).toBeCloseTo(1)
  })

  it('reads the same at the same concentration, whatever the depth of sand', () => {
    expect(saturation(POROSITY * 2 * 0.5, 2, 0)).toBeCloseTo(saturation(POROSITY * 20 * 0.5, 20, 0))
  })

  it('bare rock holds nothing, but reads wet under water and dry out of it', () => {
    expect(saturation(0, 0, 0.5)).toBe(1)
    expect(saturation(0, 0, 0)).toBe(0)
  })
})

describe('Moisture soaks in at a rate', () => {
  const perStep = STEP_SOAK

  it('takes no more than SOAK_RATE allows in a step', () => {
    const grid = makeGrid(1, 1, (perStep * 5) / POROSITY)
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(1, 1)

    moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)!).toBeCloseTo(perStep, 6)
    expect(1 - grid.getWaterHeight(0, 0)!).toBeCloseTo(perStep, 6)
  })

  it('deep dry sand takes several steps to fill, shallow sand one', () => {
    const stepsToFill = (sand: number) => {
      const grid = makeGrid(1, 1, sand)
      grid.setWaterHeight(0, 0, 1)
      const moisture = new Moisture(1, 1)
      let steps = 0
      while (saturation(grid.getMoisture(0, 0)!, sand, 1) < 1 - 1e-6 && steps < 1000) {
        moisture.step(grid, DT)
        steps++
      }
      return steps
    }

    // Capacities stated against a step's soaking, not as bare depths, so the
    // rate can be tuned without this test moving.
    expect(stepsToFill((perStep * 0.5) / POROSITY)).toBe(1)
    expect(stepsToFill((perStep * 3.5) / POROSITY)).toBe(4)
  })
})

describe('Moisture absorbs water', () => {
  it('dry sand under water fills to its whole capacity from the column', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(1, 1)

    soakFor(grid, moisture)

    expect(1 - grid.getWaterHeight(0, 0)!).toBeCloseTo(CAPACITY, 6)
    expect(grid.getMoisture(0, 0)!).toBeCloseTo(CAPACITY, 6)
  })

  it('deeper sand holds more water: capacity is the whole depth, uncapped', () => {
    const shallow = makeGrid(1, 1, 1)
    const deep = makeGrid(1, 1, 10)
    shallow.setWaterHeight(0, 0, 1)
    deep.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(1, 1)

    soakFor(shallow, moisture)
    soakFor(deep, moisture)

    expect(deep.getMoisture(0, 0)!).toBeCloseTo(shallow.getMoisture(0, 0)! * 10, 6)
  })

  it('damp sand takes only what it is short of', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, 1)
    grid.setMoisture(0, 0, CAPACITY - STEP_SOAK / 2)
    const moisture = new Moisture(1, 1)

    moisture.step(grid, DT)

    expect(1 - grid.getWaterHeight(0, 0)!).toBeCloseTo(STEP_SOAK / 2, 6)
  })

  it('saturated sand takes nothing', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, 0.5)
    grid.setMoisture(0, 0, CAPACITY)
    const moisture = new Moisture(1, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(0.5)
  })

  it('bare rock takes nothing', () => {
    const grid = makeGrid(1, 1, 0)
    grid.setWaterHeight(0, 0, 0.5)
    const moisture = new Moisture(1, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(0.5)
    expect(grid.getMoisture(0, 0)).toBe(0)
  })

  it('soaks up a film thinner than the shortfall entirely', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, STEP_SOAK / 2)
    const moisture = new Moisture(1, 1)

    moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(0)
    // Dry above once the film is gone, so it starts drying the same step.
    expect(grid.getMoisture(0, 0)!).toBeCloseTo(STEP_SOAK / 2, 4)
  })

  it('settles the sediment of water it soaks up entirely', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, STEP_SOAK / 2)
    grid.setSediment(0, 0, 0.003)
    const moisture = new Moisture(1, 1)

    moisture.step(grid, DT)

    expect(grid.getSediment(0, 0)).toBe(0)
    expect(grid.getSandHeight(0, 0)!).toBeCloseTo(SAND + 0.003, 6)
  })

  it('a wet cell stops being charged once it is full', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, 0.5)
    const moisture = new Moisture(1, 1)
    soakFor(grid, moisture)
    const afterFirst = grid.getWaterHeight(0, 0)

    const dirty = moisture.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)).toBe(afterFirst)
    expect(dirty[0]).toBe(0)
  })
})

describe('Moisture spreads', () => {
  it('moves water from damp sand into dry, and creates none', () => {
    const grid = makeGrid()
    grid.setMoisture(1, 0, CAPACITY)
    const moisture = new Moisture(4, 1)
    // Without evaporation, by measuring before any is due: one step's worth.
    const before = held(grid)

    moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)!).toBeGreaterThan(0)
    expect(grid.getMoisture(2, 0)!).toBeGreaterThan(0)
    expect(grid.getMoisture(1, 0)!).toBeLessThan(CAPACITY)
    expect(held(grid)).toBeLessThanOrEqual(before)
  })

  it('a wet cell feeds its neighbours and tops itself up from the column', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)
    moisture.step(grid, DT)
    const columnAfterSoaking = grid.getWaterHeight(0, 0)!

    for (let i = 0; i < 30; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(1, 0)!).toBeGreaterThan(0)
    expect(grid.getWaterHeight(0, 0)!).toBeLessThan(columnAfterSoaking)
  })

  it('flows between cells by saturation, not by amount', () => {
    // A shallow cell, saturated, beside a deep one holding more water but
    // less than half full: water moves from shallow to deep.
    const grid = makeGrid(2, 1)
    grid.setSandHeight(0, 0, 1)
    grid.setMoisture(0, 0, POROSITY * 1)
    grid.setSandHeight(1, 0, 10)
    grid.setMoisture(1, 0, POROSITY * 10 * 0.4)
    const moisture = new Moisture(2, 1)

    moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)!).toBeLessThan(POROSITY * 1)
  })

  it('nothing spreads across bare rock', () => {
    const grid = makeGrid(3, 1)
    grid.setSandHeight(1, 0, 0)
    grid.setMoisture(0, 0, CAPACITY)
    const moisture = new Moisture(3, 1)

    for (let i = 0; i < 30; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(2, 0)).toBe(0)
  })
})

describe('Moisture dries', () => {
  it('loses the same water per second from deep sand as from shallow', () => {
    // Both saturated, single cells so nothing spreads: only depth differs.
    const shallow = makeGrid(1, 1, 1)
    const deep = makeGrid(1, 1, 10)
    shallow.setMoisture(0, 0, POROSITY * 1)
    deep.setMoisture(0, 0, POROSITY * 10)
    const moisture = new Moisture(1, 1)

    for (let i = 0; i < 30; i++) {
      moisture.step(shallow, DT)
      moisture.step(deep, DT)
    }

    const shallowLoss = POROSITY * 1 - shallow.getMoisture(0, 0)!
    const deepLoss = POROSITY * 10 - deep.getMoisture(0, 0)!
    expect(shallowLoss).toBeGreaterThan(0)
    expect(shallowLoss / deepLoss).toBeGreaterThan(0.9)
    expect(shallowLoss / deepLoss).toBeLessThan(1.1)
  })

  it('dries out completely, to exactly zero', () => {
    const grid = makeGrid(1, 1, 1)
    grid.setMoisture(0, 0, POROSITY)
    const moisture = new Moisture(1, 1)

    for (let i = 0; i < 30 * 600; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBe(0)
  })

  it('sand under water does not dry', () => {
    const grid = makeGrid(1, 1)
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(1, 1)
    soakFor(grid, moisture)
    const soaked = grid.getMoisture(0, 0)

    for (let i = 0; i < 30; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBe(soaked)
  })

  it('a fully dry grid stays dry', () => {
    const grid = makeGrid()
    const moisture = new Moisture(4, 1)

    for (let i = 0; i < 10; i++) moisture.step(grid, DT)

    expect(held(grid)).toBe(0)
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

  it('a cell whose water was soaked up entirely is flagged dirty', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, STEP_SOAK / 2)
    grid.setMoisture(0, 0, CAPACITY / 2)
    const moisture = new Moisture(4, 1)

    const dirty = moisture.step(grid, DT)

    expect(dirty[0]).toBe(1)
  })

  it('an isolated dry cell that stays dry is not dirty', () => {
    const grid = makeGrid()
    const moisture = new Moisture(4, 1)

    const dirty = moisture.step(grid, DT)

    expect(dirty[3]).toBe(0)
  })

  it('a dry neighbour that visibly gains moisture is flagged', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture(4, 1)

    let dirty = moisture.step(grid, DT)
    for (let i = 0; i < 60 && dirty[1] === 0; i++) dirty = moisture.step(grid, DT)

    expect(dirty[1]).toBe(1)
  })
})
