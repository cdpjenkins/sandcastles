import { describe, it, expect } from 'vitest'
import { Sponge } from './Sponge.ts'
import { WaterSim } from './WaterSim.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30
const DEPTH = 200
const SEA_SURFACE = 20
const LAUNCH_Z = 150
const AMPLITUDE = 1

// A deep channel running along z, flat at elevation 20, with the domain edge at
// z = DEPTH - 1 standing in for the seaward boundary.  The wave is launched as a
// smooth hump rather than a single raised cell: a one-cell spike is a delta
// function, and disperses into a tail that fills the channel and drowns out the
// reflection we are trying to measure.
const channelWithWave = () => {
  const grid = new Grid(1, DEPTH)
  for (let z = 0; z < DEPTH; z++) {
    grid.setRockHeight(0, z, 0)
    grid.setWaterHeight(0, z, SEA_SURFACE)
  }
  for (let z = LAUNCH_Z - 12; z <= LAUNCH_Z + 12; z++) {
    const t = (z - LAUNCH_Z) / 12
    grid.setWaterHeight(0, z, SEA_SURFACE + AMPLITUDE * Math.cos((t * Math.PI) / 2) ** 2)
  }
  return grid
}

describe('Sponge', () => {
  it('absorbs a wave heading for the boundary instead of reflecting it back', () => {
    // The seaward half of the hump reaches the boundary ~49 cells away in about
    // 3.5s at c = sqrt(9.8*20) = 14 cells/s.  Reflected, it is back in midchannel
    // by t=10s; the shoreward half is long past by then.
    const grid = channelWithWave()
    const sim = new WaterSim(1, DEPTH)
    const sponge = new Sponge(1, DEPTH)

    for (let i = 0; i < 30 * 10; i++) {
      sim.step(grid, DT)
      sponge.step(grid, sim, DT, SEA_SURFACE)
    }

    let returned = 0
    for (let z = 60; z < 140; z++) {
      returned = Math.max(returned, Math.abs(grid.getWaterHeight(0, z)! - SEA_SURFACE))
    }

    // A reflection coefficient, against the incident amplitude. Under 10% is the
    // usual bar for an absorbing layer; a closed wall returns essentially all of it.
    expect(returned).toBeLessThan(AMPLITUDE * 0.1)
  })

  it('leaves water well inshore of the sponge untouched', () => {
    const grid = channelWithWave()
    const sim = new WaterSim(1, DEPTH)
    const sponge = new Sponge(1, DEPTH)
    const before = grid.getWaterHeight(0, 20)!

    sponge.step(grid, sim, DT, SEA_SURFACE)

    expect(grid.getWaterHeight(0, 20)!).toBe(before)
  })
})
