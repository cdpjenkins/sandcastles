import { describe, it, expect } from 'vitest'
import { rockColour } from './rockColour.ts'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

describe('rockColour', () => {
  it('dry rock matches base rock colour', () => {
    const expectedHex = MATERIAL_PROPS[Material.Rock].colour.replace('#', '')
    expect(rockColour(0).getHexString()).toBe(expectedHex)
  })

  it('wet rock is darker than dry rock', () => {
    const wet = rockColour(1)
    const dry = rockColour(0)
    expect(wet.r).toBeLessThan(dry.r)
    expect(wet.g).toBeLessThan(dry.g)
    expect(wet.b).toBeLessThan(dry.b)
  })

  it('partial moisture colour sits between dry and wet', () => {
    const half = rockColour(0.5)
    const dry = rockColour(0)
    const wet = rockColour(1)
    expect(half.r).toBeLessThan(dry.r)
    expect(half.r).toBeGreaterThan(wet.r)
  })

  it('moisture clamped — values outside [0,1] do not extrapolate', () => {
    const atZero = rockColour(0)
    const atOne = rockColour(1)
    expect(rockColour(-1).r).toBeCloseTo(atZero.r, 5)
    expect(rockColour(2).r).toBeCloseTo(atOne.r, 5)
  })
})
