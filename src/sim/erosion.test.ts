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

  it('saturates the rate the bed drops rather than eroding ever faster', () => {
    // Erosion moving the bed in a single step is a step change in the water's
    // surface, which shoves the sim.  Left proportional to velocity it feeds
    // back -- scour deepens the channel, which speeds the water, which scours --
    // and the sea tears itself apart.  Past some rate the bed must stop dropping
    // faster however fast the water gets.
    const erodedAtFlux = (flux: number): number => {
      const w = 4
      const grid = new Grid(w, 1)
      for (let x = 0; x < w; x++) {
        grid.setRockHeight(x, 0, 1)
        grid.setSandHeight(x, 0, 5)
        grid.setWaterHeight(x, 0, 0.5)
      }
      const waterSim = new WaterSim(w, 1)
      const erosion = new Erosion(w, 1)
      for (let x = 0; x < w - 1; x++) waterSim.setFlowX(x, 0, flux)

      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)

      return 5 - grid.getSandHeight(1, 0)!
    }

    // Both are past the limit, so they should match. Unlimited, doubling the
    // flux doubles the scour.
    expect(erodedAtFlux(1)).toBeCloseTo(erodedAtFlux(2), 6)
  })

  it('a thin sheet scours more than a deep pool carrying the same flux', () => {
    // Flat water over flat ground, given a uniform flux: no surface gradient, so
    // the only difference between the two runs is how deep the water is.  The
    // same flux through a thin sheet is fast-moving water and should scour hard;
    // through a deep column it is barely moving and should not.
    //
    // The forcing has to be this large for the scene to say anything at all.  Below
    // it both readings sit at zero, held there by the threshold of motion; far above
    // it both pin at MAX_BED_RATE.  There is no forcing at which both come off the
    // stops together, so this reads "one moves, the other does not" rather than
    // comparing two amounts -- see the saturation note in CLAUDE.md.
    const FLUX = 8.0
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
      for (let x = 0; x < w - 1; x++) waterSim.setFlowX(x, 0, FLUX)

      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)

      return 5 - grid.getSandHeight(1, 0)!
    }

    expect(erodedAtDepth(1)).toBeGreaterThan(erodedAtDepth(4))
  })

  it('a stream cuts a channel and leaves the hillside beside it standing', () => {
    // The behaviour that separates a river from a sheet wash.  Capacity follows
    // stream power -- speed times the tilt the water is running down -- so water
    // gathering into a channel finds a steeper surface there than over the ground
    // either side, cuts harder for it, and gathers more.  Erosion concentrates and
    // the channel deepens.  Take the slope term away and every wet cell scours at
    // much the same rate, so the stream planes the whole hillside down instead.
    //
    // Stated as banks rather than a width, because a width in cells is a number
    // that moves with every knob in the model, whereas "the ground ten cells away
    // is untouched" is what a channel means at any setting worth shipping.
    const bedAt = (z: number): number => 10 + (40 - z) * 0.4
    const grid = new Grid(40, 40)
    for (let z = 0; z < 40; z++)
      for (let x = 0; x < 40; x++) {
        grid.setRockHeight(x, z, 1)
        grid.setSandHeight(x, z, bedAt(z))
      }
    grid.setSourceRate(20, 1, 3)

    const waterSim = new WaterSim(40, 40)
    const erosion = new Erosion(40, 40)
    for (let i = 0; i < 40 / DT; i++) {
      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)
    }

    for (const z of [24, 28]) {
      const cutAt = (x: number): number => bedAt(z) - grid.getSandHeight(x, z)!
      let floor = 0
      let centre = 0
      for (let x = 0; x < 40; x++) if (cutAt(x) > floor) { floor = cutAt(x); centre = x }

      let awayFromChannel = 0
      for (let x = 0; x < 40; x++)
        if (Math.abs(x - centre) >= 10) awayFromChannel = Math.max(awayFromChannel, cutAt(x))

      expect(floor).toBeGreaterThan(1)
      expect(awayFromChannel).toBeLessThan(floor / 4)
    }
  })

  it('a lake rocking gently leaves its own bed alone', () => {
    // Real sediment has a threshold of motion: below some stream power the grains
    // simply stay put. Without one, every wet cell scours whatever the water is
    // doing, so an enclosed lake quietly strips its own bed bare -- and because
    // the surface is bed + water, a bed moving under a standing wave feeds that
    // wave, which scours harder still.
    const size = 32
    const rim = 4
    const depth = 10
    const grid = new Grid(size, size)
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        const onRim = x < rim || x >= size - rim || z < rim || z >= size - rim
        grid.setRockHeight(x, z, -5)
        grid.setSandHeight(x, z, onRim ? depth + 25 : 5)
        grid.setWaterHeight(x, z, onRim ? 0 : depth)
      }
    // tip the surface a little, so the lake is rocking rather than dead flat
    for (let z = rim; z < size - rim; z++)
      for (let x = rim; x < size - rim; x++)
        grid.setWaterHeight(x, z, depth + ((x - rim) / (size - 2 * rim) - 0.5) * 0.1)

    const waterSim = new WaterSim(size, size)
    const erosion = new Erosion(size, size)
    const bedUnderLake = (): number => {
      let sum = 0
      for (let z = rim; z < size - rim; z++)
        for (let x = rim; x < size - rim; x++) sum += grid.getSandHeight(x, z)!
      return sum
    }
    const before = bedUnderLake()

    for (let i = 0; i < 30 * 60; i++) {
      waterSim.step(grid, DT)
      erosion.step(grid, waterSim, DT)
    }

    expect(bedUnderLake()).toBeGreaterThan(before * 0.9)
  })

  it('saturates the rate the bed rises, just as it does the rate it drops', () => {
    // Deposition shoves the water surface exactly as scour does, so the same
    // bound applies to the bed coming up as to it going down.
    const depositedFromSurplus = (sediment: number): number => {
      const { grid, waterSim, erosion } = makeScene()
      grid.setSandHeight(0, 0, 2)
      grid.setWaterHeight(0, 0, 0.01)
      grid.setSediment(0, 0, sediment)

      erosion.step(grid, waterSim, DT)

      return grid.getSandHeight(0, 0)! - 2
    }

    expect(depositedFromSurplus(10)).toBeCloseTo(depositedFromSurplus(20), 6)
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

    // While it still has a bed, it only ever loses it.
    const stripped = samples.findIndex((s) => s <= 0)
    const losing = stripped < 0 ? samples.length : stripped + 1
    for (let i = 1; i < losing; i++) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]! + 1e-3)
    }

    // Once it is down to rock it stays there. A trace of what the water carries
    // does settle back -- thousandths against the 2 units it started with -- but
    // that is the stream dropping its load, not the cell rebuilding.
    for (const sample of samples.slice(losing)) {
      expect(sample).toBeLessThan(0.05)
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
