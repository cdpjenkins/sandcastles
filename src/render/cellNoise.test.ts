import { describe, it, expect } from 'vitest'
import { cellNoise } from './cellNoise.ts'

describe('cellNoise', () => {
  it('returns a value in [-1, 1]', () => {
    for (let x = 0; x < 10; x++)
      for (let z = 0; z < 10; z++) {
        const v = cellNoise(x, z)
        expect(v).toBeGreaterThanOrEqual(-1)
        expect(v).toBeLessThanOrEqual(1)
      }
  })

  it('same inputs always produce the same output', () => {
    expect(cellNoise(7, 13)).toBe(cellNoise(7, 13))
    expect(cellNoise(0, 0)).toBe(cellNoise(0, 0))
    expect(cellNoise(255, 255)).toBe(cellNoise(255, 255))
  })

  it('different cells produce different values', () => {
    const values = new Set<number>()
    for (let x = 0; x < 8; x++)
      for (let z = 0; z < 8; z++) values.add(cellNoise(x, z))
    expect(values.size).toBeGreaterThan(32)
  })
})
