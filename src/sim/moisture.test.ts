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
    const moisture = new Moisture()

    moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBeCloseTo(1.0)
  })

  it('dry adjacent cell gains moisture from wet neighbour', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture()

    for (let i = 0; i < 10; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(1, 0)!).toBeGreaterThan(0)
  })

  it('cell dries out when water is removed', () => {
    const grid = makeGrid()
    grid.setWaterHeight(0, 0, 1)
    const moisture = new Moisture()

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
    const moisture = new Moisture()

    for (let i = 0; i < 30; i++) moisture.step(grid, DT)

    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++)
        expect(grid.getMoisture(x, z)!).toBeLessThanOrEqual(1.0)
  })

  it('fully dry grid stays at zero moisture', () => {
    const grid = makeGrid()
    const moisture = new Moisture()

    for (let i = 0; i < 10; i++) moisture.step(grid, DT)

    expect(grid.getMoisture(0, 0)).toBe(0)
  })
})
