import { describe, it, expect } from 'vitest'
import { dig, dump, repeatsOnHold, ToolMode, DIG_AMOUNT, DUMP_AMOUNT } from './Tools.ts'
import { Grid } from '../core/Grid.ts'
import { Bucket } from '../core/Bucket.ts'
import { moistureAfterDrySand, WET_DEPTH } from '../sim/Moisture.ts'

// Deeper than a spadeful, and a bucket roomier than one, both stated in terms of
// DIG_AMOUNT rather than as bare numbers. A scene holding less than the tool
// takes cannot say anything about a full dig, and pinning it to a literal is how
// these went stale when a spadeful grew.
const makeGrid = () => {
  const g = new Grid(16, 16)
  g.setRockHeight(8, 0, 1)
  g.setSandHeight(8, 0, DIG_AMOUNT * 2)
  return g
}

const roomyBucket = () => new Bucket(DIG_AMOUNT * 2)

describe('dig', () => {
  it('removes sand from the cell', () => {
    const grid = makeGrid()
    const bucket = roomyBucket()
    const before = grid.getSandHeight(8, 0)!
    dig(grid, 8, 0, bucket)
    expect(grid.getSandHeight(8, 0)).toBeCloseTo(before - DIG_AMOUNT)
  })

  it('fills the bucket by DIG_AMOUNT', () => {
    const grid = makeGrid()
    const bucket = roomyBucket()
    dig(grid, 8, 0, bucket)
    expect(bucket.amount).toBeCloseTo(DIG_AMOUNT)
  })

  it('returns true when sand was removed', () => {
    const grid = makeGrid()
    const bucket = roomyBucket()
    expect(dig(grid, 8, 0, bucket)).toBe(true)
  })

  it('does nothing to rock and returns false', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 2)
    const bucket = new Bucket(100)
    const result = dig(grid, 5, 5, bucket)
    expect(result).toBe(false)
    expect(bucket.amount).toBe(0)
  })

  it('does nothing when bucket is full and returns false', () => {
    const grid = makeGrid()
    const bucket = new Bucket(DIG_AMOUNT)
    bucket.fill(DIG_AMOUNT)
    const before = grid.getSandHeight(8, 0)!
    const result = dig(grid, 8, 0, bucket)
    expect(result).toBe(false)
    expect(grid.getSandHeight(8, 0)).toBeCloseTo(before)
  })

  it('digging into a nearly-full bucket does not destroy sand', () => {
    // The spade cannot take more than the bucket will hold. Whatever leaves the
    // ground has to arrive in the bucket -- sand is only ever moved, never lost.
    const grid = makeGrid()
    const bucket = roomyBucket()
    bucket.fill(bucket.capacity - DIG_AMOUNT / 2)
    const before = grid.getSandHeight(8, 0)! + bucket.amount

    dig(grid, 8, 0, bucket)

    expect(grid.getSandHeight(8, 0)! + bucket.amount).toBeCloseTo(before)
  })

  it('a bucket with room for less than a spadeful digs only what it can hold', () => {
    const grid = makeGrid()
    const bucket = roomyBucket()
    bucket.fill(bucket.capacity - DIG_AMOUNT / 2)
    const before = grid.getSandHeight(8, 0)!

    dig(grid, 8, 0, bucket)

    expect(grid.getSandHeight(8, 0)).toBeCloseTo(before - DIG_AMOUNT / 2)
    expect(bucket.amount).toBeCloseTo(bucket.capacity)
  })

  it('does not dig below zero sand height', () => {
    const grid = new Grid(16, 16)
    grid.setSandHeight(5, 5, 0.1)
    const bucket = new Bucket(100)
    dig(grid, 5, 5, bucket)
    expect(grid.getSandHeight(5, 5)).toBeGreaterThanOrEqual(0)
  })
})

describe('dump', () => {
  it('adds sand to the cell', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(100)
    bucket.fill(50)
    const before = grid.getSandHeight(5, 5)!
    dump(grid, 5, 5, bucket)
    expect(grid.getSandHeight(5, 5)).toBeCloseTo(before + DUMP_AMOUNT)
  })

  it('empties the bucket by DUMP_AMOUNT', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(100)
    bucket.fill(50)
    dump(grid, 5, 5, bucket)
    expect(bucket.amount).toBeCloseTo(50 - DUMP_AMOUNT)
  })

  it('returns true when sand was placed', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    const bucket = new Bucket(100)
    bucket.fill(50)
    expect(dump(grid, 5, 5, bucket)).toBe(true)
  })

  it('dumped sand is dry: a full load leaves damp sand dry on top', () => {
    const grid = new Grid(16, 16)
    grid.setSandHeight(5, 5, 5)
    grid.setMoisture(5, 5, 1)
    const bucket = new Bucket(100)
    bucket.fill(50)

    dump(grid, 5, 5, bucket)

    expect(grid.getMoisture(5, 5)).toBe(moistureAfterDrySand(1, 5, DUMP_AMOUNT))
    expect(grid.getMoisture(5, 5)).toBeLessThan(1)
  })

  it('a last scrap of sand only partly dries the cell', () => {
    const grid = new Grid(16, 16)
    grid.setSandHeight(5, 5, 5)
    grid.setMoisture(5, 5, 1)
    const bucket = new Bucket(100)
    bucket.fill(WET_DEPTH / 4)

    dump(grid, 5, 5, bucket)

    expect(grid.getMoisture(5, 5)!).toBeCloseTo(moistureAfterDrySand(1, 5, WET_DEPTH / 4))
    expect(grid.getMoisture(5, 5)!).toBeGreaterThan(0)
  })

  it('does nothing when bucket is empty and returns false', () => {
    const grid = new Grid(16, 16)
    grid.setRockHeight(5, 5, 1)
    grid.setMoisture(5, 5, 0.7)
    const bucket = new Bucket(100)
    const result = dump(grid, 5, 5, bucket)
    expect(grid.getMoisture(5, 5)).toBeCloseTo(0.7)
    expect(result).toBe(false)
    expect(grid.getSandHeight(5, 5)).toBe(0)
  })
})

describe('repeatsOnHold', () => {
  // Game cannot be built under jsdom, so a branch left inline there is one
  // nothing catches if it is ever inverted - and inverting this one paints a
  // run of springs across the beach on a single drag.
  it('repeats the spade', () => {
    expect(repeatsOnHold(ToolMode.Spade)).toBe(true)
  })

  it('repeats the dump', () => {
    expect(repeatsOnHold(ToolMode.Dump)).toBe(true)
  })

  it('does not repeat the stream', () => {
    // One click, one source. A repeat on the pressed cell would be a no-op
    // anyway, and the tool is the one that can flood the beach by accident.
    expect(repeatsOnHold(ToolMode.Stream)).toBe(false)
  })
})
