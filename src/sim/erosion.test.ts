import { describe, it, expect } from 'vitest'
import { Erosion } from './Erosion.ts'
import { WaterSim } from './WaterSim.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30

const makeScene = (w = 4, d = 1) => {
  const grid = new Grid(w, d)
  for (let x = 0; x < w; x++) grid.setRockHeight(x, 0, 1)
  const waterSim = new WaterSim(w, d)
  const erosion = new Erosion(w, d)
  return { grid, waterSim, erosion }
}

describe('Erosion', () => {
  it('erodes under moving water but leaves still water alone', () => {
    // Stated as a comparison rather than an amount.  How much a given scene
    // erodes is set by EROSION_K, a knob that has already moved twice and will
    // move again; that erosion happens at all under flow and never without it is
    // true at any setting above zero.
    const erodedWhere = (still: boolean): number => {
      const { grid, waterSim, erosion } = makeScene()
      for (let x = 0; x < 4; x++) {
        grid.setSandHeight(x, 0, 5)
        if (still) grid.setWaterHeight(x, 0, 3)
      }
      if (!still) grid.setWaterHeight(0, 0, 3)

      for (let i = 0; i < 30; i++) {
        waterSim.step(grid, DT)
        erosion.step(grid, waterSim, DT)
      }

      return 5 - grid.getSandHeight(0, 0)!
    }

    expect(erodedWhere(false)).toBeGreaterThan(erodedWhere(true))
    expect(erodedWhere(true)).toBeCloseTo(0)
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

  it('a thin sheet scours more than a deep pool carrying the same flux', () => {
    // Flat water over flat ground, given a uniform flux: no surface gradient, so
    // the only difference between the two runs is how deep the water is.  The
    // same flux through a thin sheet is fast-moving water and should scour hard;
    // through a deep column it is barely moving and should not.
    const erodedAtDepth = (depth: number): number => {
      const w = 4
      const grid = new Grid(w, 1)
      for (let x = 0; x < w; x++) {
        grid.setRockHeight(x, 0, 1)
        grid.setSandHeight(x, 0, 5)
        grid.setWaterHeight(x, 0, depth)
      }
      const waterSim = new WaterSim(w, 1)
      const erosion = new Erosion(w, 1)
      for (let x = 0; x < w - 1; x++) waterSim.setFlowX(x, 0, 1.0)

      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)

      return 5 - grid.getSandHeight(1, 0)!
    }

    expect(erodedAtDepth(1)).toBeGreaterThan(erodedAtDepth(4))
  })

  it('cell with large sediment surplus deposits a substantial amount in one step', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 2)
    grid.setWaterHeight(0, 0, 0.01)
    grid.setSediment(0, 0, 10)

    erosion.step(grid, waterSim, DT)

    const sandAfter = grid.getSandHeight(0, 0)!
    expect(sandAfter).toBeGreaterThan(2.1)
    expect(sandAfter).toBeLessThan(2.2)
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

describe('Erosion sediment transport', () => {
  it('eroded sediment moves downstream instead of redepositing in place', () => {
    const w = 10
    const grid = new Grid(w, 1)
    for (let x = 0; x < w; x++) {
      grid.setRockHeight(x, 0, w - x)
      grid.setSandHeight(x, 0, 2)
    }
    grid.setSourceRate(0, 0, 3.0)
    const waterSim = new WaterSim(w, 1)
    const erosion = new Erosion(w, 1)

    const samples: number[] = []
    for (let i = 0; i < 600; i++) {
      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)
      if (i % 60 === 59) samples.push(grid.getSandHeight(2, 0)!)
    }

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]! + 1e-3)
    }
    expect(samples.at(-1)!).toBeLessThan(2)

    const downstreamSediment = grid.getSediment(w - 1, 0)! + grid.getSandHeight(w - 1, 0)!
    expect(downstreamSediment).toBeGreaterThan(2)
  })
})

describe('Erosion dirty mask', () => {
  it('step returns a Uint8Array with length width*depth', () => {
    const { grid, waterSim, erosion } = makeScene(4, 1)
    const dirty = erosion.step(grid, waterSim, DT)
    expect(dirty).toBeInstanceOf(Uint8Array)
    expect(dirty.length).toBe(4)
  })

  it('a cell that erodes is flagged dirty', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 5)
    grid.setWaterHeight(0, 0, 3)
    waterSim.step(grid, DT)

    const dirty = erosion.step(grid, waterSim, DT)

    expect(dirty[0]).toBe(1)
  })

  it('a cell that deposits sand is flagged dirty', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 2)
    grid.setWaterHeight(0, 0, 0.01)
    grid.setSediment(0, 0, 10)

    const dirty = erosion.step(grid, waterSim, DT)

    expect(dirty[0]).toBe(1)
  })

  it('a cell skipped because water is below the erosion threshold is not dirty', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 5)
    grid.setWaterHeight(0, 0, 0)

    const dirty = erosion.step(grid, waterSim, DT)

    expect(dirty[0]).toBe(0)
  })

  it('a rock cell with no sand and no water stays clean', () => {
    const { grid, waterSim, erosion } = makeScene()
    grid.setSandHeight(0, 0, 0)
    grid.setWaterHeight(0, 0, 0)

    const dirty = erosion.step(grid, waterSim, DT)

    expect(dirty[0]).toBe(0)
  })
})

function totalSandAndSediment(grid: Grid, w: number, d: number): number {
  let sum = 0
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++)
      sum += (grid.getSandHeight(x, z) ?? 0) + (grid.getSediment(x, z) ?? 0)
  return sum
}
