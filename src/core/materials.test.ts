import { describe, it, expect } from 'vitest'
import { Material, MATERIAL_PROPS } from './materials.ts'

describe('Material properties', () => {
  it('rock is not diggable', () => {
    expect(MATERIAL_PROPS[Material.Rock].diggable).toBe(false)
  })

  it('rock has zero erodibility', () => {
    expect(MATERIAL_PROPS[Material.Rock].erodibility).toBe(0)
  })

  it('sand is diggable', () => {
    expect(MATERIAL_PROPS[Material.Sand].diggable).toBe(true)
  })

  it('sand angle of repose is 20 degrees', () => {
    expect(MATERIAL_PROPS[Material.Sand].angleOfRepose).toBe(20)
  })

  it('gravel has a steeper angle of repose than sand', () => {
    expect(MATERIAL_PROPS[Material.Gravel].angleOfRepose).toBeGreaterThan(
      MATERIAL_PROPS[Material.Sand].angleOfRepose
    )
  })

  it('water is not diggable', () => {
    expect(MATERIAL_PROPS[Material.Water].diggable).toBe(false)
  })

  it('every material has a hex colour string', () => {
    for (const mat of Object.values(Material)) {
      expect(MATERIAL_PROPS[mat].colour).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
