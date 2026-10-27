import { describe, it, expect } from 'vitest'
import { Grid } from '../../Grid.ts'
import { Slope } from '../../../sim/Slope.ts'
import {
  layBeachV2, SCARP_BENCH, SCARP_SAND_RAMP, SCARP_SIDE_SLOPE, SHORE_ZONE_ROWS,
} from './BeachGeneratorV2.ts'
import type { ScarpPlacementV2 } from './BeachGeneratorV2.ts'
import type { ShapeV2, ScarpV2 } from './ShapeV2.ts'

const PLAIN: ShapeV2 = {
  seaFraction: 0.78,
  seaLevel: 2,
  tideAmplitude: 0.8,
  tidePeriod: 180,
  swellFrequency: 1,
  swellStrength: 1,
  ridgeScale: 1,
  ridgePower: 2,
  sandShare: 9 / 21,
  noiseScale: 1,
  scarps: [],
}

const SCARP: ScarpV2 = { row: 0.5, xCentre: 0.5, span: 24, height: 6, faceWidth: 1, wobble: 12345 }

// A beach laid with these scarps, and where each one went: where a scarp sits
// depends on the ground it is cut into, so only the layout knows.
const layWith = (scarps: ScarpV2[], seed = 0, sea: Partial<ShapeV2> = {}): [Grid, ScarpPlacementV2[]] => {
  const grid = new Grid(256, 256)
  const shape = { ...PLAIN, ...sea, scarps }
  grid.setSea({ ...grid.sea, seaStart: Math.floor(256 * shape.seaFraction) })
  return [grid, layBeachV2(grid, shape, seed)]
}
const laid = (scarps: ScarpV2[], seed = 0, sea: Partial<ShapeV2> = {}): Grid => layWith(scarps, seed, sea)[0]

const surface = (grid: Grid, x: number, z: number) => grid.getSurfaceHeight(x, z)!

describe('A v2 scarp', () => {
  for (const faceWidth of [1, 2]) {
    it(`drops the surface by its height across a ${faceWidth}-cell face, in every column of the notch`, () => {
      const scarp = { ...SCARP, faceWidth }
      const [grid, [place]] = layWith([scarp])

      for (let x = place.x0; x <= place.x1; x++) {
        const foot = place.footRow(x)
        expect(surface(grid, x, foot - faceWidth) - surface(grid, x, foot)).toBeCloseTo(scarp.height, 3)
      }
    })
  }

  it('leaves the lip and its bench bare rock, and the sand behind no steeper than the ramp', () => {
    const [grid, [place]] = layWith([SCARP])

    for (let x = place.x0; x <= place.x1; x++) {
      const lip = place.footRow(x) - SCARP.faceWidth
      for (let z = lip; z > lip - SCARP_BENCH; z--) expect(grid.getSandHeight(x, z)).toBe(0)
      for (let z = lip - SCARP_BENCH; z >= 0; z--) {
        expect(grid.getSandHeight(x, z)!).toBeLessThanOrEqual((lip - z - SCARP_BENCH + 1) * SCARP_SAND_RAMP + 1e-6)
      }
    }
  })

  // Shaped under the angle of repose, so Slope finds nothing to move that it
  // would not move on the same beach without the scarp: the noise leaves some
  // natural slopes steeper than sand stands, and those are not the scarp's.
  // In the spike, sand left steeper than repose buried a 10-high face in 300s.
  for (const seed of [0, 12345, -777]) {
    it(`gives Slope nothing new to move, seed ${seed}`, () => {
      const scarp = { ...SCARP, height: 10, faceWidth: 2 }
      const moved = (grid: Grid): Set<number> => {
        const before = grid.snapshot().sand
        new Slope(256, 256).step(grid)
        const after = grid.snapshot().sand
        const cells = new Set<number>()
        before.forEach((sand, i) => { if (Math.abs(after[i]! - sand) > 1e-6) cells.add(i) })
        return cells
      }
      const withScarp = moved(laid([scarp], seed))
      const without = moved(laid([], seed))

      const added = [...withScarp].filter((i) => !without.has(i)).map((i) => `${i % 256},${Math.floor(i / 256)}`)
      expect(added).toEqual([])
    })
  }

  it('walls the foot in: the ground beside the notch stands above it', () => {
    const [grid, [place]] = layWith([SCARP])

    for (const [inside, outside] of [[place.x0, place.x0 - 1], [place.x1, place.x1 + 1]] as const) {
      const foot = place.footRow(inside)
      expect(surface(grid, outside, foot)).toBeGreaterThan(surface(grid, inside, foot) + SCARP.height / 2)
    }
  })

  // The raised ground beside the notch is a headland ramping back down to the
  // beach, and beyond the ramp the beach is as it would have been.
  it('ramps the ground beside the notch back down seaward, and leaves it alone beyond', () => {
    const [grid, [place]] = layWith([SCARP])
    const plain = laid([])
    const raised = (x: number, z: number) => grid.getRockHeight(x, z)! - plain.getRockHeight(x, z)!

    for (const x of [place.x0 - 1, place.x0 - 10, place.x1 + 1, place.x1 + 30]) {
      const face = place.footRow(x)
      for (let z = face - 1; z < face + place.ramp; z++) {
        expect(raised(x, z) - raised(x, z + 1)).toBeLessThanOrEqual(SCARP_SIDE_SLOPE + 1e-4)
      }
      for (let z = face + place.ramp; z < grid.depth; z++) expect(raised(x, z)).toBeCloseTo(0, 5)
    }
  })

  it('leaves the beach seaward of its foot alone, inside the notch', () => {
    const [grid, [place]] = layWith([SCARP])
    const plain = laid([])

    for (let x = place.x0; x <= place.x1; x++) {
      for (let z = place.footRow(x); z < grid.depth; z += 3) {
        expect(grid.getRockHeight(x, z)).toBeCloseTo(plain.getRockHeight(x, z)!, 5)
        expect(grid.getSandHeight(x, z)).toBeCloseTo(plain.getSandHeight(x, z)!, 5)
      }
    }
  })

  it('meanders its face across the notch', () => {
    const [, [place]] = layWith([SCARP])
    const rows = new Set<number>()
    for (let x = place.x0; x <= place.x1; x++) rows.add(place.footRow(x))

    expect(rows.size).toBeGreaterThan(1)
  })

  // The shore zone is where v1 fades the rock to the sea, and where the swell,
  // refraction and castle survival were tuned. The worst case: the lowest sea,
  // the furthest-forward row and the highest scarp, whose ramps run longest.
  it('keeps out of the shore zone, ramps included', () => {
    const worst = { ...SCARP, row: 1, height: 10, faceWidth: 2 }
    const [grid, [place]] = layWith([worst], 0, { seaFraction: 0.74 })
    const plain = laid([], 0, { seaFraction: 0.74 })

    for (let x = 0; x < grid.width; x++) {
      expect(place.footRow(x) + place.ramp).toBeLessThanOrEqual(grid.seaStart - SHORE_ZONE_ROWS)
      for (let z = grid.seaStart - SHORE_ZONE_ROWS; z < grid.depth; z++) {
        expect(grid.getRockHeight(x, z)).toBe(plain.getRockHeight(x, z))
        expect(grid.getSandHeight(x, z)).toBe(plain.getSandHeight(x, z))
      }
    }
  })

  it('puts its notch inside the beach wherever it is centred', () => {
    for (const xCentre of [0, 1]) {
      const [grid, [place]] = layWith([{ ...SCARP, xCentre, span: 40 }])
      expect(place.x0).toBeGreaterThanOrEqual(0)
      expect(place.x1).toBeLessThan(grid.width)
      expect(place.x1 - place.x0 + 1).toBe(40)
    }
  })

  it('leaves no water standing on land that has risen above the sea', () => {
    const grid = laid([SCARP])
    for (let z = 0; z < grid.seaStart; z++) {
      for (let x = 0; x < grid.width; x++) {
        const s = surface(grid, x, z)
        expect(grid.getWaterHeight(x, z)).toBeCloseTo(s < grid.seaLevel ? grid.seaLevel - s : 0, 5)
      }
    }
  })
})
