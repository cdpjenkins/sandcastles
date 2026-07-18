import { describe, it, expect } from 'vitest'
import { Waves } from './Waves.ts'
import { Sponge } from './Sponge.ts'
import { WaterSim } from './WaterSim.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30
const X = 128

const beach = () => {
  const grid = new Grid(256, 256)
  grid.initBeach()
  return grid
}

const surfaceAt = (grid: Grid, z: number): number =>
  (grid.getSurfaceHeight(X, z) ?? 0) + (grid.getWaterHeight(X, z) ?? 0)

// Peak-to-trough range of the surface at z over the given run.
const rangeAt = (z: number, seconds: number, skip: number): number => {
  const grid = beach()
  const waves = new Waves(grid.width, grid.depth)
  const sim = new WaterSim(grid.width, grid.depth)
  const sponge = new Sponge(grid.width, grid.depth)

  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < 30 * seconds; i++) {
    waves.step(grid, DT, grid.seaLevel)
    sim.step(grid, DT)
    sponge.step(grid, sim, DT, (zz) => waves.surfaceAt(zz, grid.seaLevel))
    if (i >= 30 * skip) {
      const s = surfaceAt(grid, z)
      min = Math.min(min, s)
      max = Math.max(max, s)
    }
  }
  return max - min
}

describe('Swell', () => {
  it('drives the boundary row up and down', () => {
    expect(rangeAt(255, 12, 2)).toBeGreaterThan(0.5)
  })

  it('sends swell travelling inshore, well past the sponge', () => {
    // The sponge occupies the outermost 12 rows (z >= 244).  A cell at z = 210
    // is 34 rows clear of it, so anything moving there arrived under its own
    // steam rather than being imposed.
    expect(rangeAt(210, 20, 8)).toBeGreaterThan(0.2)
  })
})
