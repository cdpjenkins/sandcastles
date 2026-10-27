import { describe, it, expect } from 'vitest'
import { Grid } from '../../Grid.ts'
import { newGameSnapshot, applySnapshot } from '../../GameSnapshot.ts'
import { WaterSim } from '../../../sim/WaterSim.ts'
import { Waves } from '../../../sim/Waves.ts'
import { Tide } from '../../../sim/Tide.ts'
import { shapeV2 } from './ShapeV2.ts'
import { beachGeneratorV2, generateBeachV2 } from './BeachGeneratorV2.ts'

const grown = (generate: (grid: Grid, seed: string) => void, seed: string): Grid => {
  const grid = new Grid(256, 256)
  generate(grid, seed)
  return grid
}

describe('The v2 generator', () => {
  it('is version 2, with no classic beach', () => {
    expect(beachGeneratorV2.version).toBe(2)
    expect(beachGeneratorV2.hasClassic).toBe(false)
  })

  // v2 began as an exact copy of v1, and a test said so until the sea was
  // seeded. That test is gone on purpose: from here, v2 grows its own beaches.
  it("lays the beach out on the shape's sea", () => {
    for (const seed of ['salty-gull-42', 's46', 'gull']) {
      const shape = shapeV2(seed)
      const grid = grown(generateBeachV2, seed)

      expect(grid.seaStart).toBe(Math.floor(256 * shape.seaFraction))
      expect(grid.seaLevel).toBe(shape.seaLevel)
    }
  })

  it('fills the sea rows with water up to its level', () => {
    const grid = grown(generateBeachV2, 'salty-gull-42')

    for (let z = grid.seaStart; z < grid.depth; z += 7) {
      for (let x = 0; x < grid.width; x += 31) {
        expect(grid.getWaterSurfaceHeight(x, z)).toBeCloseTo(grid.seaLevel, 4)
      }
    }
    expect(grid.getWaterHeight(128, grid.seaStart - 30)).toBe(0)
  })

  it('gives two seeds different seas', () => {
    const a = grown(generateBeachV2, 'salty-gull-42')
    const b = grown(generateBeachV2, 's46')

    expect(a.seaStart).not.toBe(b.seaStart)
    expect(a.seaLevel).not.toBe(b.seaLevel)
  })

  it('keeps its sea through a new game and a restore', () => {
    const snapshot = newGameSnapshot(256, 256, { generator: 2, seed: 'salty-gull-42' })
    const target = new Grid(256, 256)
    applySnapshot({
      grid: target, waterSim: new WaterSim(256, 256), waves: new Waves(256, 256), tide: new Tide(),
      bucket: { setAmount: () => {}, setWater: () => {} }, camera: { restore: () => {} },
    }, snapshot)

    expect(target.sea).toEqual(grown(generateBeachV2, 'salty-gull-42').sea)
    expect(target.seaStart).toBe(Math.floor(256 * shapeV2('salty-gull-42').seaFraction))
  })

  it("gives the beach the shape's tide", () => {
    for (const seed of ['salty-gull-42', 's46', 'gull']) {
      const shape = shapeV2(seed)
      const { sea } = grown(generateBeachV2, seed)

      expect(sea.tideAmplitude).toBe(shape.tideAmplitude)
      expect(sea.tidePeriod).toBe(shape.tidePeriod)
    }
  })

  it('gives two seeds different tides', () => {
    const a = grown(generateBeachV2, 'salty-gull-42').sea
    const b = grown(generateBeachV2, 's46').sea

    expect(a.tideAmplitude).not.toBe(b.tideAmplitude)
    expect(a.tidePeriod).not.toBe(b.tidePeriod)
  })

  // Nothing was ever tested below 180s, so no beach's tide turns faster.
  it('never gives a tide a period under 180s', () => {
    for (let i = 0; i < 30; i++) {
      expect(grown(generateBeachV2, `s${i}`).sea.tidePeriod).toBeGreaterThanOrEqual(180)
    }
  })

  // Classic is a v1 idea. The guard and resolveBeach already keep a null seed
  // away from v2; this says what happens if something gets past them.
  it('refuses to grow a beach from no seed', () => {
    expect(() => generateBeachV2(new Grid(64, 64), null)).toThrow()
    expect(() => beachGeneratorV2.generate(new Grid(64, 64), null)).toThrow()
  })
})
