import { describe, it, expect } from 'vitest'
import { Erosion } from './Erosion.ts'
import { WaterSim } from './WaterSim.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30

const makeScene = (w = 4, d = 1) => {
  const grid = new Grid(w, d)
  for (let x = 0; x < w; x++) grid.setRockHeight(x, 0, 1)
  const waterSim = new WaterSim(w, d)
  const erosion = new Erosion()
  return { grid, waterSim, erosion }
}

describe('Erosion', () => {
  it('fast-flowing cell loses sand over time', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 5)
    grid.setWaterHeight(0, 0, 3)

    for (let i = 0; i < 30; i++) {
      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)
    }

    expect(grid.getSandHeight(0, 0)!).toBeLessThan(5)
  })

  it('cell with sediment above capacity deposits sand', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 2)
    grid.setWaterHeight(0, 0, 0.01)
    grid.setSediment(0, 0, 10)

    erosion.step(grid, waterSim, DT)

    expect(grid.getSandHeight(0, 0)!).toBeGreaterThan(2)
  })

  it('rock cell (zero sand) is never eroded', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 0)
    grid.setWaterHeight(0, 0, 5)

    for (let i = 0; i < 30; i++) {
      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)
    }

    expect(grid.getSandHeight(0, 0)!).toBeCloseTo(0)
    expect(grid.getRockHeight(0, 0)!).toBeCloseTo(1)
  })

  it('total sand + sediment is conserved', () => {
    const { grid, waterSim, erosion } = makeScene(4, 1)
    for (let x = 0; x < 4; x++) grid.setSandHeight(x, 0, 3)
    grid.setWaterHeight(0, 0, 4)

    const before = totalSandAndSediment(grid, 4, 1)

    for (let i = 0; i < 20; i++) {
      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)
    }

    expect(totalSandAndSediment(grid, 4, 1)).toBeCloseTo(before, 1)
  })
})

function totalSandAndSediment(grid: Grid, w: number, d: number): number {
  let sum = 0
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++)
      sum += (grid.getSandHeight(x, z) ?? 0) + (grid.getSediment(x, z) ?? 0)
  return sum
}
