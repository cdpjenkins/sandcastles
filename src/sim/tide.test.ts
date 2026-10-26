import { describe, it, expect } from 'vitest'
import { Tide } from './Tide.ts'
import { Grid } from '../core/Grid.ts'

// The tide's amplitude and period are the beach's, so they live on the grid.
const beachWithTide = (tidePeriod: number, tideAmplitude: number): Grid => {
  const grid = new Grid(16, 16)
  grid.setSea({ ...grid.sea, tidePeriod, tideAmplitude })
  return grid
}

describe('Tide', () => {
  it('follows the default sea: a 180s period and a ±0.8 amplitude', () => {
    const grid = new Grid(16, 16)
    const tide = new Tide()
    tide.step(45)
    expect(tide.offset(grid)).toBeCloseTo(0.8, 5)
    tide.step(90)
    expect(tide.offset(grid)).toBeCloseTo(-0.8, 5)
  })

  it('starts at zero offset', () => {
    const tide = new Tide()
    expect(tide.offset(beachWithTide(180, 0.4))).toBeCloseTo(0, 5)
  })

  it('reaches the top of its range a quarter of the way through the period', () => {
    const tide = new Tide()
    tide.step(45)
    expect(tide.offset(beachWithTide(180, 0.4))).toBeCloseTo(0.4, 5)
  })

  it('returns to zero at the half period', () => {
    const tide = new Tide()
    tide.step(90)
    expect(tide.offset(beachWithTide(180, 0.4))).toBeCloseTo(0, 5)
  })

  it('reaches the bottom of its range three quarters through the period', () => {
    const tide = new Tide()
    tide.step(135)
    expect(tide.offset(beachWithTide(180, 0.4))).toBeCloseTo(-0.4, 5)
  })

  it('completes a full cycle back to zero after one period', () => {
    const tide = new Tide()
    tide.step(180)
    expect(tide.offset(beachWithTide(180, 0.4))).toBeCloseTo(0, 5)
  })

  it("follows the beach's own period and amplitude", () => {
    const tide = new Tide()
    tide.step(90)
    expect(tide.offset(beachWithTide(360, 1.4))).toBeCloseTo(1.4, 5)
  })

  it('stays at sea level on a beach with no tide', () => {
    const tide = new Tide()
    tide.step(45)
    expect(tide.offset(beachWithTide(180, 0))).toBe(0)
  })

  it('accumulates elapsed time across multiple step calls', () => {
    const tide = new Tide()
    tide.step(20)
    tide.step(25)
    expect(tide.offset(beachWithTide(180, 0.4))).toBeCloseTo(0.4, 5)
  })
})

describe('Tide snapshot', () => {
  it('restores the phase it was snapshotted with, so the sea does not teleport', () => {
    const grid = new Grid(16, 16)
    const tide = new Tide()
    for (let i = 0; i < 40; i++) tide.step(1)

    const restored = new Tide()
    restored.restore(tide.snapshot())

    expect(restored.offset(grid)).toBeCloseTo(tide.offset(grid))
  })
})
