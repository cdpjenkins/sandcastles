import { describe, it, expect } from 'vitest'
import { beachLabel } from './beachLabel.ts'

describe('beachLabel', () => {
  it('names a seeded beach and the generator that grew it', () => {
    expect(beachLabel({ generator: 1, seed: 'salty-gull-42' })).toBe('salty-gull-42 (gen 1)')
  })

  it('names the classic beach', () => {
    expect(beachLabel({ generator: 1, seed: null })).toBe('classic (gen 1)')
  })

  // "gen", never a bare "v": a file also carries a save-format version, and
  // the two change for unrelated reasons.
  it('reads the generator from the beach, not a fixed label', () => {
    expect(beachLabel({ generator: 2, seed: 'gull' })).toBe('gull (gen 2)')
  })
})
