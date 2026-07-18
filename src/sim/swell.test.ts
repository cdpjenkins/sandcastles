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
    sponge.step(grid, sim, DT, (xx, zz) => waves.surfaceAt(xx, zz, grid.seaLevel))
    if (i >= 30 * skip) {
      const s = surfaceAt(grid, z)
      min = Math.min(min, s)
      max = Math.max(max, s)
    }
  }
  return max - min
}

// RMS(flowX)/RMS(flowZ) over a swell period is the tangent of the wave's angle
// away from the shore-normal: a wave running straight at the beach has no x-flow
// at all, and one at 45 degrees has equal parts of each.  Both rows come from a
// single run -- two sims would double an already slow test.
const angleTangentsAt = (zs: number[], seconds: number, skip: number): number[] => {
  const grid = beach()
  const waves = new Waves(grid.width, grid.depth)
  const sim = new WaterSim(grid.width, grid.depth)
  const sponge = new Sponge(grid.width, grid.depth)

  const sumX = zs.map(() => 0)
  const sumZ = zs.map(() => 0)
  for (let i = 0; i < 30 * seconds; i++) {
    waves.step(grid, DT, grid.seaLevel)
    sim.step(grid, DT)
    sponge.step(grid, sim, DT, (xx, zz) => waves.surfaceAt(xx, zz, grid.seaLevel))
    if (i < 30 * skip) continue
    zs.forEach((z, j) => {
      // Sample away from the x-walls, which reflect an oblique wave.
      for (let x = 64; x < 192; x += 8) {
        sumX[j]! += sim.getFlowX(x, z) ** 2
        sumZ[j]! += sim.getFlowZ(x, z) ** 2
      }
    })
  }
  return zs.map((_, j) => Math.sqrt(sumX[j]!) / Math.sqrt(sumZ[j]!))
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

  it('turns the swell toward the shore as it shallows', () => {
    // Snell's law falls out of c = sqrt(g*h): sin(theta)/c is conserved, so a
    // wave slowing over the shallows must swing toward the shore-normal.  z=240
    // sits in ~17 units of water, z=210 in ~6.  Both are read well seaward of the
    // surf zone: inside about z=210 the swash and the beach's own x-roughness
    // swamp the wave's direction, and even square-on swell reads 7 degrees there.
    const [deep, shallow] = angleTangentsAt([240, 210], 20, 10)

    expect(shallow!).toBeLessThan(deep!)
  })
})
