import { describe, it, expect } from 'vitest'
import { generatorFor, LATEST_GENERATOR, CLASSIC_BEACH } from './BeachGenerator.ts'

describe('generatorFor', () => {
  it('finds version 1, which has a classic beach', () => {
    const v1 = generatorFor(1)

    expect(v1?.version).toBe(1)
    expect(v1?.hasClassic).toBe(true)
  })

  it('finds version 2, which has none', () => {
    const v2 = generatorFor(2)

    expect(v2?.version).toBe(2)
    expect(v2?.hasClassic).toBe(false)
  })

  // A save from a newer game, or a corrupt one, names a generator this game
  // does not have. The answer is "none", for the guard to refuse.
  it('finds nothing for a version it does not have', () => {
    for (const version of [0, 3, -1, 1.5, NaN]) expect(generatorFor(version)).toBeNull()
  })
})

describe('LATEST_GENERATOR', () => {
  it('is a generator this game has', () => {
    expect(generatorFor(LATEST_GENERATOR)?.version).toBe(LATEST_GENERATOR)
  })

  // v2 grows new beaches while it is still under development: nothing deploys
  // on a push, so the only v2 beaches are on machines that cloned the repo.
  // Once the game is played anywhere else, only a frozen generator may be the
  // latest: one still changing would regrow a player's beach differently.
  it('is v2', () => {
    expect(LATEST_GENERATOR).toBe(2)
  })
})

// Classic is a v1 idea: a later generator has no classic beach to offer.
describe('CLASSIC_BEACH', () => {
  it('is v1 with no seed', () => {
    expect(CLASSIC_BEACH).toEqual({ generator: 1, seed: null })
  })
})
