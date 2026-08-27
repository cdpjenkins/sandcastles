import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Sponge } from './Sponge.ts'
import { WaterSim } from './WaterSim.ts'
import { Erosion } from './Erosion.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30
const SECONDS = 60

const SIZE = 96
const CENTRE_X = SIZE / 2
const RADIUS = 6
const HEIGHT = 3

// A cone of sand straddling the waterline, run either under the swell or on a
// flat sea, and the fraction of it gone at the end.
//
// The flat-sea run is the control, and it is not zero: a castle slumps into its
// own footprint and the tide alone moves some sand.  Only the difference between
// the two is the swell's doing, which is why the assertion below compares them
// rather than testing the swell run against a fixed floor.
const fractionLost = (withSwell: boolean): number => {
  const grid = new Grid(SIZE, SIZE)
  grid.initBeach()
  const waves = new Waves(grid.width, grid.depth)
  const waterSim = new WaterSim(grid.width, grid.depth)
  const sponge = new Sponge(grid.width, grid.depth)
  const erosion = new Erosion(grid.width, grid.depth)

  const centreZ = grid.seaStart - 4
  const eachCell = (visit: (x: number, z: number, distance: number) => void): void => {
    for (let z = centreZ - RADIUS; z <= centreZ + RADIUS; z++) {
      for (let x = CENTRE_X - RADIUS; x <= CENTRE_X + RADIUS; x++) {
        const distance = Math.hypot(x - CENTRE_X, z - centreZ)
        if (distance <= RADIUS) visit(x, z, distance)
      }
    }
  }

  let built = 0
  eachCell((x, z, distance) => {
    const added = HEIGHT * (1 - distance / RADIUS)
    grid.setSandHeight(x, z, (grid.getSandHeight(x, z) ?? 0) + added)
    built += added
  })

  const sandInFootprint = (): number => {
    let total = 0
    eachCell((x, z) => { total += grid.getSandHeight(x, z) ?? 0 })
    return total
  }

  // A flat sea still needs the sponge fed a surface, or the seaward boundary
  // radiates and the whole basin drains.
  const surface = withSwell
    ? (x: number, z: number) => waves.surfaceAt(x, z, grid.seaLevel)
    : () => grid.seaLevel

  const before = sandInFootprint()
  for (let i = 0; i < 30 * SECONDS; i++) {
    if (withSwell) waves.step(grid, DT, grid.seaLevel)
    waterSim.step(grid, DT)
    sponge.step(grid, waterSim, DT, surface)
    erosion.step(grid, waterSim, DT)
  }
  return (before - sandInFootprint()) / built
}

describe('A castle in the surf', () => {
  // The behaviour the swell knobs exist to produce, and the one the rest of the
  // suite cannot see: SWELL_PERIOD and SWELL_AMPLITUDE can be halved with every
  // other test still green while castles quietly become near-permanent.
  //
  // Stated as a ratio against a flat sea rather than an amount.  How fast a
  // castle goes is set by EROSION_K, CRITICAL_POWER and the swell knobs, all of
  // which have moved and will move again; that waves take a real bite out of a
  // castle, and do not level it inside a minute, is what the game needs at any
  // sensible setting.
  it('loses far more sand to the waves than to a flat sea', { timeout: 20000 }, () => {
    const swell = fractionLost(true)
    const flat = fractionLost(false)

    expect(swell).toBeGreaterThan(2 * flat)
    expect(swell).toBeLessThan(0.95)
  })
})
