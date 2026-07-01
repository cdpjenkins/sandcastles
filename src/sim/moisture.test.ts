import { describe, it, expect } from 'vitest'
import { Moisture } from './Moisture.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30

const makeGrid = (w = 4, d = 1) => {
  const g = new Grid(w, d)
  for (let x = 0; x < w; x++) g.setRockHeight(x, 0, 1)
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
