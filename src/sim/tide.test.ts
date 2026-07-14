import { describe, it, expect } from 'vitest'
import { Tide } from './Tide.ts'

describe('Tide', () => {
  it('defaults to a 180s period and a ±0.8 range', () => {
    const tide = new Tide()
    expect(tide.period).toBe(180)
    expect(tide.range).toBe(0.8)
  })

  it('starts at zero offset', () => {
    const tide = new Tide()
    expect(tide.offset).toBeCloseTo(0, 5)
  })

  it('reaches the top of its range a quarter of the way through the period', () => {
    const tide = new Tide(180, 0.4)
    tide.step(45)
    expect(tide.offset).toBeCloseTo(0.4, 5)
  })

  it('returns to zero at the half period', () => {
    const tide = new Tide(180, 0.4)
    tide.step(90)
    expect(tide.offset).toBeCloseTo(0, 5)
  })

  it('reaches the bottom of its range three quarters through the period', () => {
    const tide = new Tide(180, 0.4)
    tide.step(135)
    expect(tide.offset).toBeCloseTo(-0.4, 5)
  })

  it('completes a full cycle back to zero after one period', () => {
    const tide = new Tide(180, 0.4)
    tide.step(180)
    expect(tide.offset).toBeCloseTo(0, 5)
  })

  it('supports a configurable period and range', () => {
    const tide = new Tide(60, 1.5)
    expect(tide.period).toBe(60)
    expect(tide.range).toBe(1.5)
    tide.step(15)
    expect(tide.offset).toBeCloseTo(1.5, 5)
  })

  it('accumulates elapsed time across multiple step calls', () => {
    const tide = new Tide(180, 0.4)
    tide.step(20)
    tide.step(25)
    expect(tide.offset).toBeCloseTo(0.4, 5)
  })
})
