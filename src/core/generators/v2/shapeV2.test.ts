import { describe, it, expect } from 'vitest'
import { seedFromText } from '../../BeachSeed.ts'
import { seededRandomV2 } from './RandomV2.ts'
import { shapeV2, drawShapeV2 } from './ShapeV2.ts'
import type { ShapeV2 } from './ShapeV2.ts'

// Every seeded parameter and the range v2's sweep set for it (PLAN.md step 12).
// When a range moves, it moves here and in ShapeV2 together.
const RANGES: Record<Exclude<keyof ShapeV2, 'scarps'>, [number, number]> = {
  seaFraction: [0.74, 0.80],
  seaLevel: [1.6, 2.4],
  tideAmplitude: [0.4, 1.4],
  tidePeriod: [180, 360],
  swellFrequency: [0.78, 1],
  swellStrength: [0.5, 1],
  ridgeScale: [0.7, 1.3],
  ridgePower: [1.5, 2.5],
  sandShare: [0.25, 0.65],
  noiseScale: [1.0, 1.6],
}

function expectInRange(shape: ShapeV2): void {
  for (const [field, [lo, hi]] of Object.entries(RANGES)) {
    const value = shape[field as keyof typeof RANGES]
    expect(value, field).toBeGreaterThanOrEqual(lo)
    expect(value, field).toBeLessThanOrEqual(hi)
  }
  expect(shape.scarps.length).toBeGreaterThanOrEqual(0)
  expect(shape.scarps.length).toBeLessThanOrEqual(2)
  for (const scarp of shape.scarps) {
    expect(scarp.row).toBeGreaterThanOrEqual(0)
    expect(scarp.row).toBeLessThanOrEqual(1)
    expect(scarp.xCentre).toBeGreaterThanOrEqual(0)
    expect(scarp.xCentre).toBeLessThanOrEqual(1)
    expect(Number.isInteger(scarp.span)).toBe(true)
    expect(scarp.span).toBeGreaterThanOrEqual(10)
    expect(scarp.span).toBeLessThanOrEqual(40)
    expect(scarp.height).toBeGreaterThanOrEqual(3)
    expect(scarp.height).toBeLessThanOrEqual(10)
    expect([1, 2]).toContain(scarp.faceWidth)
    expect(Number.isInteger(scarp.wobble)).toBe(true)
    expect(scarp.wobble).toBeGreaterThanOrEqual(0)
    expect(scarp.wobble).toBeLessThan(2 ** 32)
  }
}

// A random source stuck at one value: every draw lands at the same point of
// its range, so 0 and just under 1 reach both ends of all of them at once.
const stuckAt = (r: number) => () => r

describe('drawShapeV2', () => {
  it('reaches the bottom of every range and no further', () => {
    const shape = drawShapeV2(stuckAt(0))

    expectInRange(shape)
    for (const [field, [lo]] of Object.entries(RANGES)) {
      expect(shape[field as keyof typeof RANGES], field).toBeCloseTo(lo, 10)
    }
    expect(shape.scarps).toEqual([])
  })

  it('reaches the top of every range and no further', () => {
    const shape = drawShapeV2(stuckAt(1 - 2 ** -32))

    expectInRange(shape)
    for (const [field, [, hi]] of Object.entries(RANGES)) {
      expect(shape[field as keyof typeof RANGES], field).toBeCloseTo(hi, 6)
    }
    expect(shape.scarps).toHaveLength(2)
    for (const scarp of shape.scarps) {
      expect(scarp.span).toBe(40)
      expect(scarp.height).toBeCloseTo(10, 6)
      expect(scarp.faceWidth).toBe(2)
    }
  })
})

describe('shapeV2', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => `s${i}`)

  it('keeps every value inside its range, scarps included', () => {
    for (const seed of seeds) expectInRange(shapeV2(seed))
  })

  it('draws every number of scarps it allows', () => {
    const counts = new Set(seeds.map((seed) => shapeV2(seed).scarps.length))
    expect([...counts].sort()).toEqual([0, 1, 2])
  })

  it('gives the same shape every time for the same seed', () => {
    expect(shapeV2('salty-gull-42')).toEqual(shapeV2('salty-gull-42'))
  })

  it('gives different seeds different shapes', () => {
    const distinct = new Set(seeds.map((seed) => JSON.stringify(shapeV2(seed))))
    expect(distinct.size).toBe(seeds.length)
  })

  // As noiseSeed trims, or the same land would grow under a different shape.
  it('trims the seed', () => {
    expect(shapeV2('  gull ')).toEqual(shapeV2('gull'))
  })

  // Its own stream, so neither the shape nor the spring takes draws from the
  // other: changing what one draws cannot move the other.
  it("draws from its own stream, not the spring's", () => {
    const own = drawShapeV2(seededRandomV2(seedFromText('gull:shape')))
    const spring = drawShapeV2(seededRandomV2(seedFromText('gull:spring')))

    expect(shapeV2('gull')).toEqual(own)
    expect(shapeV2('gull')).not.toEqual(spring)
  })
})
