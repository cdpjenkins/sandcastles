import { describe, it, expect } from 'vitest'
import { Grid, STREAM_RATE } from '../core/Grid.ts'
import { getSources } from './SourceList.ts'

describe('getSources', () => {
  it('finds nothing on a grid nobody has dug a spring into', () => {
    const grid = new Grid(8, 8)

    expect(getSources(grid)).toEqual([])
  })

  it('reports a source cell with its coordinates and rate', () => {
    const grid = new Grid(8, 8)
    grid.setSourceRate(3, 5, STREAM_RATE)

    expect(getSources(grid)).toEqual([{ x: 3, z: 5, rate: STREAM_RATE }])
  })

  it('finds every source, not just the first', () => {
    const grid = new Grid(8, 8)
    grid.setSourceRate(1, 1, STREAM_RATE)
    grid.setSourceRate(6, 2, STREAM_RATE)
    grid.setSourceRate(4, 7, STREAM_RATE)

    expect(getSources(grid).map(({ x, z }) => [x, z])).toEqual([[1, 1], [6, 2], [4, 7]])
  })

  it('leaves out a cell whose source has been turned off', () => {
    const grid = new Grid(8, 8)
    grid.setSourceRate(2, 2, STREAM_RATE)
    grid.setSourceRate(2, 2, 0)

    expect(getSources(grid)).toEqual([])
  })

  // The rate is reported rather than assumed: the Stream tool sets STREAM_RATE
  // today, but source is a rate per cell and not a flag, so a list that read
  // every source as 1.0 would be lying about any other value.
  it('reports a rate the Stream tool did not set', () => {
    const grid = new Grid(8, 8)
    grid.setSourceRate(0, 0, 0.25)

    expect(getSources(grid)[0]!.rate).toBeCloseTo(0.25)
  })

  it('finds the spring a fresh beach starts with', () => {
    const grid = new Grid(256, 256)
    grid.initBeach()
    grid.initSpring(STREAM_RATE)

    expect(getSources(grid)).toHaveLength(1)
  })
})
