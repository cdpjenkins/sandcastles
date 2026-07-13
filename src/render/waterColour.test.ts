import { describe, it, expect } from 'vitest'
import { Color } from 'three'
import { waterColour } from './waterColour.ts'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

const SAND = new Color(MATERIAL_PROPS[Material.Sand].colour)
const WATER = new Color(MATERIAL_PROPS[Material.Water].colour)

describe('waterColour', () => {
  it('zero depth returns the underlying colour unchanged', () => {
    const col = waterColour(SAND, 0)
    expect(col.getHexString()).toBe(SAND.getHexString())
  })

  it('very shallow water sits closer to the underlying colour than to water', () => {
    const col = waterColour(SAND, 0.02)
    const distToSand = Math.abs(col.r - SAND.r)
    const distToWater = Math.abs(col.r - WATER.r)
    expect(distToSand).toBeLessThan(distToWater)
  })

  it('deep water reads as the water colour', () => {
    const col = waterColour(SAND, 5)
    expect(col.getHexString()).toBe(WATER.getHexString())
  })

  it('depth beyond the opacity threshold does not extrapolate past the water colour', () => {
    const atThreshold = waterColour(SAND, 1)
    const beyond = waterColour(SAND, 100)
    expect(beyond.getHexString()).toBe(atThreshold.getHexString())
  })

  it('deeper water is bluer than shallower water', () => {
    const shallow = waterColour(SAND, 0.05)
    const deeper = waterColour(SAND, 0.3)
    expect(deeper.b).toBeGreaterThan(shallow.b)
  })

  it('very shallow water already blends noticeably toward the water colour', () => {
    const col = waterColour(SAND, 0.02)
    const t = (SAND.r - col.r) / (SAND.r - WATER.r)
    expect(t).toBeGreaterThan(0.15)
  })
})
