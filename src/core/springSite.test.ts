import { describe, it, expect } from 'vitest'
import {
  fillCost, springSite, MAX_SPRING_FILL, SPRING_ROW_BAND, SPRING_SIDE_MARGIN,
} from './SpringSite.ts'
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

// The same valley, wide enough that the side margin leaves somewhere to stand:
// 25 wide, centre line x = 12.
const WIDE = 25
const CENTRE = 12

function aWideValley(): Grid {
  const grid = new Grid(WIDE, DEPTH)
  for (let z = 0; z < DEPTH; z++) {
    for (let x = 0; x < WIDE; x++) {
      grid.setRockHeight(x, z, 20 - z + 5 * Math.abs(x - CENTRE))
    }
  }
  return grid
}

// Sinks the centre line at row z so it holds `volume` before spilling on.
function digWidePit(grid: Grid, z: number, volume: number): void {
  grid.setRockHeight(CENTRE, z, grid.getRockHeight(CENTRE, z + 1)! - volume)
}

const SEEDS = Array.from({ length: 20 }, (_, i) => `s${i + 1}`)

describe('springSite', () => {
  it('puts the spring as high up the beach as it can', () => {
    for (const seed of SEEDS) {
      expect(springSite(aWideValley(), seed).z).toBeLessThanOrEqual(SPRING_ROW_BAND)
    }
  })

  it('tolerates a hollow small enough to fill', () => {
    const grid = aWideValley()
    digWidePit(grid, 6, MAX_SPRING_FILL / 2)

    expect(springSite(grid, 's1').z).toBeLessThanOrEqual(SPRING_ROW_BAND)
  })

  // The whole upper valley drains into a hollow too big to fill, so the spring
  // goes below it rather than above it.
  it('moves below a hollow too big to fill', () => {
    const grid = aWideValley()
    digWidePit(grid, 6, MAX_SPRING_FILL * 2)
    const cost = fillCost(grid)

    for (const seed of SEEDS) {
      const site = springSite(grid, seed)
      expect(site.z).toBeGreaterThan(6)
      expect(cost[site.z * WIDE + site.x]).toBeLessThanOrEqual(MAX_SPRING_FILL)
    }
  })

  it('keeps off the side walls', () => {
    for (const seed of SEEDS) {
      const { x } = springSite(aWideValley(), seed)
      expect(x).toBeGreaterThanOrEqual(SPRING_SIDE_MARGIN)
      expect(x).toBeLessThan(WIDE - SPRING_SIDE_MARGIN)
    }
  })

  // A spring in a pool would not be a stream at all.
  it('stands on dry land', () => {
    const grid = aWideValley()
    for (let z = 0; z < 3; z++) {
      for (let x = 0; x < WIDE; x++) grid.setWaterHeight(x, z, 0.5)
    }

    for (const seed of SEEDS) {
      const site = springSite(grid, seed)
      expect(grid.getWaterHeight(site.x, site.z)).toBe(0)
      expect(site.z).toBeLessThan(grid.seaStart)
    }
  })

  it('is the same spot every time for the same seed', () => {
    expect(springSite(aWideValley(), 'salty-gull-42'))
      .toEqual(springSite(aWideValley(), 'salty-gull-42'))
  })

  it('lets the seed choose between equally good spots', () => {
    const sites = new Set(SEEDS.map((seed) => {
      const { x, z } = springSite(aWideValley(), seed)
      return `${x},${z}`
    }))

    expect(sites.size).toBeGreaterThan(1)
  })

  // A trench along the shore holds more than any spring can fill, and every
  // drop on the beach runs into it. Nothing is under budget, so the spring
  // takes the cheapest ground there is - below the pit, which costs extra.
  it('takes the cheapest ground when nothing is under budget', () => {
    const grid = aWideValley()
    for (let x = 0; x < WIDE; x++) {
      grid.setRockHeight(x, 14, grid.getRockHeight(x, 15)! - MAX_SPRING_FILL)
    }
    digWidePit(grid, 3, 10)
    const cost = fillCost(grid)
    let cheapest = Infinity
    for (let z = 0; z < grid.seaStart; z++) {
      for (let x = SPRING_SIDE_MARGIN; x < WIDE - SPRING_SIDE_MARGIN; x++) {
        cheapest = Math.min(cheapest, cost[z * WIDE + x]!)
      }
    }
    expect(cheapest).toBeGreaterThan(MAX_SPRING_FILL)

    for (const seed of SEEDS) {
      const site = springSite(grid, seed)
      expect(cost[site.z * WIDE + site.x]).toBe(cheapest)
      expect(site.z).toBeGreaterThan(3)
    }
  })
})
