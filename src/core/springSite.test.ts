import { describe, it, expect } from 'vitest'
import { fillCost } from './SpringSite.ts'
import { Grid } from './Grid.ts'

// 5 wide, 20 deep: seaStart is 15. The land is a valley falling towards the sea
// and towards its centre line, x = 2, so water anywhere runs down the middle -
// a route no tie-break can change.
const WIDTH = 5
const DEPTH = 20
const MID = 2

function aValley(): Grid {
  const grid = new Grid(WIDTH, DEPTH)
  for (let z = 0; z < DEPTH; z++) {
    for (let x = 0; x < WIDTH; x++) {
      grid.setRockHeight(x, z, 20 - z + 5 * Math.abs(x - MID))
    }
  }
  return grid
}

// Sinks the valley floor at row z by `depth` below the next cell down it, so
// the pit holds exactly `depth` before it spills on towards the sea.
function digPit(grid: Grid, z: number, depth: number): void {
  grid.setRockHeight(MID, z, grid.getRockHeight(MID, z + 1)! - depth)
}

const costAt = (grid: Grid, x: number, z: number): number =>
  fillCost(grid)[z * grid.width + x]!

describe('fillCost', () => {
  it('scores every cell', () => {
    expect(fillCost(aValley())).toHaveLength(WIDTH * DEPTH)
  })

  it('costs nothing where the water runs straight to the sea', () => {
    const cost = fillCost(aValley())

    expect(Math.max(...cost)).toBe(0)
  })

  it('costs a pit what it holds before it spills', () => {
    const grid = aValley()
    digPit(grid, 5, 4)

    expect(costAt(grid, MID, 5)).toBeCloseTo(4)
  })

  // The spring does not have to sit in the hollow to pay for it: its water
  // runs down into the pit and must fill it before going on.
  it('charges the pit to every cell whose water runs through it', () => {
    const grid = aValley()
    digPit(grid, 5, 4)

    expect(costAt(grid, MID, 2)).toBeCloseTo(4)
    expect(costAt(grid, MID + 1, 2)).toBeCloseTo(4)
  })

  it('does not charge a pit to water that runs in below it', () => {
    const grid = aValley()
    digPit(grid, 5, 4)

    expect(costAt(grid, MID, 8)).toBe(0)
  })

  // A hollow is paid for once, as a whole, not once per cell it covers.
  it('charges a long hollow once, for all it holds', () => {
    const grid = aValley()
    const floor = grid.getRockHeight(MID, 7)! - 4
    grid.setRockHeight(MID, 5, floor)
    grid.setRockHeight(MID, 6, floor)

    expect(costAt(grid, MID, 4)).toBeCloseTo(8)
  })

  it('adds up every hollow on the way down', () => {
    const grid = aValley()
    digPit(grid, 4, 3)
    digPit(grid, 9, 2)

    expect(costAt(grid, MID, 1)).toBeCloseTo(5)
    expect(costAt(grid, MID, 6)).toBeCloseTo(2)
  })

  // Water already standing in a pit inland is a lake, however low it lies:
  // it is not the sea, and the spring's water still has to get past it.
  it('treats an inland pool as a hollow, not as the sea', () => {
    const grid = aValley()
    digPit(grid, 5, 4)
    grid.setWaterHeight(MID, 5, 2)

    expect(costAt(grid, MID, 5)).toBeCloseTo(4)
  })

  // The other side of the same line: water joined to the sea rows is the sea.
  it('treats water joined to the sea as the sea', () => {
    const dry = aValley()
    digPit(dry, 14, 3)
    const wet = aValley()
    digPit(wet, 14, 3)
    wet.setWaterHeight(MID, 14, 3)

    expect(costAt(dry, MID, 14)).toBeCloseTo(3)
    expect(costAt(wet, MID, 14)).toBe(0)
    expect(costAt(wet, MID, 10)).toBe(0)
  })

  it('costs nothing in the sea', () => {
    const grid = aValley()
    digPit(grid, 5, 4)
    const cost = fillCost(grid)

    for (let i = grid.seaStart * WIDTH; i < WIDTH * DEPTH; i++) expect(cost[i]).toBe(0)
  })
})
