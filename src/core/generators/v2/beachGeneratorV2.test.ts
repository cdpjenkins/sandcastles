import { describe, it, expect } from 'vitest'
import { Grid } from '../../Grid.ts'
import { generateBeachV1 } from '../v1/BeachGeneratorV1.ts'
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

  // Scaffolding: v2 starts as a copy of v1, and this says the copy is exact.
  // Step 6 of the v2 plan seeds the sea and removes it on purpose.
  it('grows the same beach as v1 from the same seed, for now', () => {
    for (const seed of ['salty-gull-42', 's46']) {
      const v1 = grown(generateBeachV1, seed)
      const v2 = grown(generateBeachV2, seed)

      expect(v2.sea).toEqual(v1.sea)
      expect(v2.snapshot()).toEqual(v1.snapshot())
    }
  })

  // Classic is a v1 idea. The guard and resolveBeach already keep a null seed
  // away from v2; this says what happens if something gets past them.
  it('refuses to grow a beach from no seed', () => {
    expect(() => generateBeachV2(new Grid(64, 64), null)).toThrow()
    expect(() => beachGeneratorV2.generate(new Grid(64, 64), null)).toThrow()
  })
})
