import { describe, it, expect } from 'vitest'
import { seedFromText, noiseSeed, randomSeed, SEED_ADJECTIVES, SEED_NOUNS } from './BeachSeed.ts'

describe('seedFromText', () => {
  // The hash is part of the save format: a stored seed regenerates its beach
  // through it, so it must never change. These are the published FNV-1a 32-bit
  // test vectors, as signed 32-bit integers.
  it('is FNV-1a over ASCII text', () => {
    expect(seedFromText('')).toBe(0x811c9dc5 | 0)
    expect(seedFromText('a')).toBe(0xe40c292c | 0)
    expect(seedFromText('foobar')).toBe(0xbf9cf968 | 0)
  })

  // Over UTF-16 code units, not UTF-8 bytes, so it parts company with the
  // published vectors outside ASCII. Pinned so that cannot shift silently.
  it('hashes non-ASCII text by its UTF-16 code units', () => {
    expect(seedFromText('é')).toBe(Math.imul(0x811c9dc5 ^ 0xe9, 0x01000193))
  })
})

describe('noiseSeed', () => {
  it('is 0 for the classic beach', () => {
    expect(noiseSeed(null)).toBe(0)
  })

  it('hashes a seed text', () => {
    expect(noiseSeed('salty-gull-42')).toBe(seedFromText('salty-gull-42'))
  })

  it('ignores surrounding whitespace', () => {
    expect(noiseSeed('  salty-gull-42 \n')).toBe(noiseSeed('salty-gull-42'))
  })

  it('tells different seeds apart', () => {
    expect(noiseSeed('salty-gull-42')).not.toBe(noiseSeed('salty-gull-43'))
  })
})

describe('randomSeed', () => {
  // Hands out the given values in turn.
  const sequence = (...values: number[]) => {
    let i = 0
    return () => values[i++ % values.length]!
  }

  it('is two words and a two-digit number', () => {
    for (let i = 0; i < 200; i++) {
      expect(randomSeed(Math.random)).toMatch(/^[a-z]+-[a-z]+-\d{2}$/)
    }
  })

  it('takes each part from its own draw', () => {
    expect(randomSeed(sequence(0, 0, 0))).toBe(`${SEED_ADJECTIVES[0]}-${SEED_NOUNS[0]}-10`)
    expect(randomSeed(sequence(0.9999, 0.9999, 0.9999)))
      .toBe(`${SEED_ADJECTIVES.at(-1)}-${SEED_NOUNS.at(-1)}-99`)
  })

  it('gives different seeds for different draws', () => {
    expect(randomSeed(sequence(0.1, 0.5, 0.3))).not.toBe(randomSeed(sequence(0.6, 0.2, 0.8)))
  })

  // Nothing to trim, so what the player is shown is exactly what was hashed.
  it('is already in the form noiseSeed hashes', () => {
    const seed = randomSeed(Math.random)
    expect(noiseSeed(seed)).toBe(seedFromText(seed))
  })
})
