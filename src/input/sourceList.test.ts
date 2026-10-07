import { describe, it, expect } from 'vitest'
import { Grid, STREAM_RATE } from '../core/Grid.ts'
import { getSources, formatSourceList, type SourceCell } from './SourceList.ts'

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

describe('formatSourceList', () => {
  const cells = (...coords: [number, number][]): SourceCell[] =>
    coords.map(([x, z]) => ({ x, z, rate: STREAM_RATE }))

  it('counts the sources in the heading', () => {
    const text = formatSourceList(cells([1, 2], [3, 4]))

    expect(text).toContain('Sources (2)')
  })

  it('gives one line per source, with its coordinates and rate', () => {
    const lines = formatSourceList(cells([12, 40], [33, 51])).split('\n')

    expect(lines.some((l) => l.includes('12') && l.includes('40') && l.includes('1.00'))).toBe(true)
    expect(lines.some((l) => l.includes('33') && l.includes('51') && l.includes('1.00'))).toBe(true)
  })

  it('shows the rate a source actually has, not the one the tool sets', () => {
    const text = formatSourceList([{ x: 1, z: 1, rate: 0.25 }])

    expect(text).toContain('0.25')
  })

  // The panel says what to do about it, because the empty list is what a
  // player sees on a beach they have not dug a spring into yet - the one
  // moment the list cannot explain itself.
  it('says there are none, and how to make one', () => {
    const text = formatSourceList([])

    expect(text).toContain('Sources (0)')
    expect(text).toMatch(/Stream/)
  })

  // The Stream tool paints a cell per pick, so a player who drags it can leave
  // hundreds behind. An uncapped list would run off the bottom of the screen
  // and bury the count, which is the part worth reading.
  it('caps a long list rather than running off the screen', () => {
    const many = cells(...Array.from({ length: 60 }, (_, i): [number, number] => [i, i]))

    const lines = formatSourceList(many).split('\n')

    expect(lines.length).toBeLessThan(30)
  })

  it('still reports the true total when the list is capped, and how many it hid', () => {
    const many = cells(...Array.from({ length: 60 }, (_, i): [number, number] => [i, i]))

    const text = formatSourceList(many)

    expect(text).toContain('Sources (60)')
    expect(text).toContain('40 more')
  })

  it('does not claim to have hidden anything when it listed them all', () => {
    const text = formatSourceList(cells([1, 1], [2, 2]))

    expect(text).not.toMatch(/more/)
  })
})
