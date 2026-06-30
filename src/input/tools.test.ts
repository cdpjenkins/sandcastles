import { describe, it, expect } from 'vitest'
import { dig, dump, DIG_AMOUNT, DUMP_AMOUNT } from './Tools.ts'
import { Grid } from '../core/Grid.ts'
import { Bucket } from '../core/Bucket.ts'

const makeGrid = () => {
  const g = new Grid(16, 16)
  g.initBeach()
  return g
}

describe('dig', () => {
  it('removes sand from the cell', () => {
    const grid = makeGrid()
    const bucket = new Bucket(10)
    const before = grid.getSandHeight(8, 0)!
    dig(grid, 8, 0, bucket)
    expect(grid.getSandHeight(8, 0)).toBeCloseTo(before - DIG_AMOUNT)
  })

  it('fills the bucket by DIG_AMOUNT', () => {
    const grid = makeGrid()
    const bucket = new Bucket(10)
    dig(grid, 8, 0, bucket)
    expect(bucket.amount).toBeCloseTo(DIG_AMOUNT)
  })

  it('returns true when sand was removed', () => {
    const grid = makeGrid()
    const bucket = new Bucket(10)
    expect(dig(grid, 8, 0, bucket)).toBe(true)
  })

  it('does nothing to rock and returns false', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 2)
    const bucket = new Bucket(10)
    const result = dig(grid, 5, 5, bucket)
    expect(result).toBe(false)
    expect(bucket.amount).toBe(0)
  })

  it('does nothing when bucket is full and returns false', () => {
    const grid = makeGrid()
    const bucket = new Bucket(10)
    bucket.fill(10)
    const before = grid.getSandHeight(8, 0)!
    const result = dig(grid, 8, 0, bucket)
    expect(result).toBe(false)
    expect(grid.getSandHeight(8, 0)).toBeCloseTo(before)
  })

  it('does not dig below zero sand height', () => {
    const grid = new Grid(16, 16)
    grid.setSandHeight(5, 5, 0.1)
    const bucket = new Bucket(10)
    dig(grid, 5, 5, bucket)
    expect(grid.getSandHeight(5, 5)).toBeGreaterThanOrEqual(0)
  })
})

describe('dump', () => {
  it('adds sand to the cell', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(10)
    bucket.fill(5)
    const before = grid.getSandHeight(5, 5)!
    dump(grid, 5, 5, bucket)
    expect(grid.getSandHeight(5, 5)).toBeCloseTo(before + DUMP_AMOUNT)
  })

  it('empties the bucket by DUMP_AMOUNT', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(10)
    bucket.fill(5)
    dump(grid, 5, 5, bucket)
    expect(bucket.amount).toBeCloseTo(5 - DUMP_AMOUNT)
  })

  it('returns true when sand was placed', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(10)
    bucket.fill(5)
    expect(dump(grid, 5, 5, bucket)).toBe(true)
  })

  it('does nothing when bucket is empty and returns false', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(10)
    const result = dump(grid, 5, 5, bucket)
    expect(result).toBe(false)
    expect(grid.getSandHeight(5, 5)).toBe(0)
  })
})
