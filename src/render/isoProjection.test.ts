import { describe, it, expect } from 'vitest'
import { worldToScreenDirection } from './isoProjection.ts'

describe('worldToScreenDirection', () => {
  it('projects the world +x axis to down-right on screen', () => {
    const { right, up } = worldToScreenDirection(1, 0)
    expect(right).toBeGreaterThan(0)
    expect(up).toBeLessThan(0)
  })

  it('projects the world +z axis to down-left on screen', () => {
    const { right, up } = worldToScreenDirection(0, 1)
    expect(right).toBeLessThan(0)
    expect(up).toBeLessThan(0)
  })

  it('projects the world -x axis to up-left on screen', () => {
    const { right, up } = worldToScreenDirection(-1, 0)
    expect(right).toBeLessThan(0)
    expect(up).toBeGreaterThan(0)
  })

  it('projects the world -z axis to up-right on screen', () => {
    const { right, up } = worldToScreenDirection(0, -1)
    expect(right).toBeGreaterThan(0)
    expect(up).toBeGreaterThan(0)
  })

  it('projects the (+x, +z) diagonal straight down on screen', () => {
    const { right, up } = worldToScreenDirection(1, 1)
    expect(right).toBeCloseTo(0)
    expect(up).toBeLessThan(0)
  })

  it('projects the (+x, -z) diagonal straight right on screen', () => {
    const { right, up } = worldToScreenDirection(1, -1)
    expect(right).toBeGreaterThan(0)
    expect(up).toBeCloseTo(0)
  })
})
