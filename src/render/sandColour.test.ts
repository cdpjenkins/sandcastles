import { describe, it, expect } from 'vitest'
import { sandColour } from './sandColour.ts'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

describe('sandColour', () => {
  it('dry sand matches base sand hex #c2a06e', () => {
    expect(sandColour(0).getHexString()).toBe('c2a06e')
  })

  it('dry sand tracks MATERIAL_PROPS[Sand].colour rather than its own copy', () => {
    const expectedHex = MATERIAL_PROPS[Material.Sand].colour.replace('#', '')
    expect(sandColour(0).getHexString()).toBe(expectedHex)
  })

  it('wet sand is darker than dry sand', () => {
    const wet = sandColour(1)
    const dry = sandColour(0)
    expect(wet.r).toBeLessThan(dry.r)
    expect(wet.g).toBeLessThan(dry.g)
  })

  it('partial moisture colour sits between dry and wet', () => {
    const half = sandColour(0.5)
    const dry = sandColour(0)
    const wet = sandColour(1)
    expect(half.r).toBeLessThan(dry.r)
    expect(half.r).toBeGreaterThan(wet.r)
  })

  it('moisture clamped — values outside [0,1] do not extrapolate', () => {
    const atZero = sandColour(0)
    const atOne = sandColour(1)
    expect(sandColour(-1).r).toBeCloseTo(atZero.r, 5)
    expect(sandColour(2).r).toBeCloseTo(atOne.r, 5)
  })
})
