import type { Grid } from '../../Grid.ts'
import { noiseSeed } from '../../BeachSeed.ts'
import type { BeachSeed } from '../../BeachSeed.ts'
import { springSiteV2 } from './SpringSiteV2.ts'
import { shapeV2 } from './ShapeV2.ts'
import type { ShapeV2, ScarpV2 } from './ShapeV2.ts'
import { seededRandomV2 } from './RandomV2.ts'
import type { BeachGenerator } from '../BeachGenerator.ts'
import type { BeachSea } from '../../BeachSea.ts'

// Version 2 of the beach generator. NOT YET FROZEN - PLAN.md builds it up step
// by step, starting from this copy of v1, and LATEST_GENERATOR stays 1 so it
// grows no player's beach until then. Once it ships, everything here is frozen
// the way v1 is: nothing may change, not a constant and not the order of an
// operation.
//
// It owns everything it calls, as v1 does, even where that duplicates v1: a
// shared helper would let a change here move every v1 beach.

const ROCK_BASE_HEIGHT = 1.0
const ROCK_NOISE_AMPLITUDE = 12
const ROCK_NOISE_OFFSET = 1000
const MIN_ROCK_HEIGHT = 0.2
const ROCK_SHORE_FADE_DISTANCE = 25
// v1's surface ridge, rock and sand together (12 + 9). A shape scales it and
// shares it between the two layers.
const RIDGE_AMPLITUDE = 21
const SAND_NOISE_AMPLITUDE = 6
const SEA_FLOOR_END_HEIGHT = -20

// Scarps: rock cliffs far steeper than sand, cut as notches. PLAN.md has the
// waterfall spike that set these.
//
// The rows next to the sea, where the rock fades into the sea bed. The swell,
// refraction and castle survival were all tuned there, so no scarp reaches it.
export const SHORE_ZONE_ROWS = ROCK_SHORE_FADE_DISTANCE
// Cells of bare rock behind a scarp's lip, and beside its notch's walls.
export const SCARP_BENCH = 4
// How fast the sand may thicken beyond the bench, per cell: under the angle
// of repose (0.625), so Slope does not empty it over the edge and bury the face.
export const SCARP_SAND_RAMP = 0.3
// How fast the raised ground beside a notch falls back to the beach, per row.
export const SCARP_SIDE_SLOPE = 0.4
// How steep sand may be left wherever a scarp has changed the ground: just
// under the angle of repose (0.625). The side ramps' 0.4 a row falls on top of
// the beach's own slope, and the sand over them can stand steeper than that.
const SCARP_SETTLE_SLOPE = 0.6
const SETTLE_TOLERANCE = 1e-4
// The first row a scarp's foot may sit on: room behind it for the spring.
const SCARP_FIRST_ROW = 20
// How far the face meanders, either way, and the columns between its turns.
const SCARP_WOBBLE_ROWS = 2
const SCARP_WOBBLE_SPACING = 8

// The spring's flow. Its own constant rather than STREAM_RATE, which the
// player's Stream tool shares, or v1's: tuning either must not change every v2
// beach.
export const V2_SPRING_RATE = 1.0

export const beachGeneratorV2: BeachGenerator = {
  version: 2,
  hasClassic: false,
  generate: (grid, seed) => generateBeachV2(grid, seed),
}

// A whole v2 beach: the sea, the land and the spring. v2 has no classic
// beach, so it is always grown from a seed.
export function generateBeachV2(grid: Grid, seed: BeachSeed): void {
  if (seed === null) throw new Error('v2 has no classic beach: it needs a seed')
  const shape = shapeV2(seed)
  grid.setSea(seaV2(grid.depth, shape))
  layBeachV2(grid, shape, noiseSeed(seed))
  const site = springSiteV2(grid, seed)
  grid.setSourceRate(site.x, site.z, V2_SPRING_RATE)
}

// The beach's whole sea, from its shape, for a beach this deep.
function seaV2(depth: number, shape: ShapeV2): BeachSea {
  return {
    seaStart: Math.floor(depth * shape.seaFraction),
    seaLevel: shape.seaLevel,
    tideAmplitude: shape.tideAmplitude,
    tidePeriod: shape.tidePeriod,
    swellFrequency: shape.swellFrequency,
    swellStrength: shape.swellStrength,
  }
}

// The land and the sea bed, with water up to sea level wherever the ground is
// below it. Lays out against the grid's sea as it stands.
//
// The shape sets the ridge: how high it stands, how its height falls away down
// the beach, and how much of it is sand. The surface ridge is shared between
// the layers rather than set per layer, so sandShare moves sand and rock
// against each other over much the same surface. noiseScale makes the land
// bolder, in both layers at once. The seed is the noise's.
//
// Each cell is written and then read back before use, so the arithmetic sees
// the same float32-rounded values the layers hold.
export function layBeachV2(grid: Grid, shape: ShapeV2, seed: number): ScarpPlacementV2[] {
  const ridgeHeight = RIDGE_AMPLITUDE * shape.ridgeScale
  const rockRidge = ridgeHeight * (1 - shape.sandShare)
  const sandRidge = ridgeHeight * shape.sandShare
  const rockNoiseAmplitude = ROCK_NOISE_AMPLITUDE * shape.noiseScale
  const sandNoiseAmplitude = SAND_NOISE_AMPLITUDE * shape.noiseScale
  const { width, depth, seaStart, seaLevel } = grid
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (z >= seaStart) {
        const seaT = (z - seaStart) / ((depth - 1) - seaStart)
        grid.setRockHeight(x, z, SEA_FLOOR_END_HEIGHT * seaT)
        grid.setSandHeight(x, z, 0)
        grid.setWaterHeight(x, z, seaLevel - grid.getRockHeight(x, z)!)
      } else {
        const t = z / seaStart
        const ridge = Math.pow(1 - t, shape.ridgePower)

        const distFromSea = seaStart - z
        const shoreFade = Math.min(1, distFromSea / ROCK_SHORE_FADE_DISTANCE)
        const rockNoise = fractalNoise(x + ROCK_NOISE_OFFSET, z + ROCK_NOISE_OFFSET, seed) * rockNoiseAmplitude
        const unfadedRock = ROCK_BASE_HEIGHT + rockRidge * ridge + rockNoise
        grid.setRockHeight(x, z, shoreFade < 1 ? unfadedRock * shoreFade : Math.max(MIN_ROCK_HEIGHT, unfadedRock))

        const base = sandRidge * ridge
        const noise = fractalNoise(x, z, seed) * sandNoiseAmplitude
        grid.setSandHeight(x, z, Math.max(0, (base + noise) * shoreFade))

        const surface = grid.getRockHeight(x, z)! + grid.getSandHeight(x, z)!
        grid.setWaterHeight(x, z, surface < seaLevel ? seaLevel - surface : 0)
      }
    }
  }
  if (shape.scarps.length === 0) return []

  // In the shape's order: a later scarp raises everything uphill of it,
  // earlier scarps included.
  const changed = new Uint8Array(width * depth)
  const placements = shape.scarps.map((scarp) => cutScarpV2(grid, scarp, changed))
  settleSandV2(grid, changed)
  for (let z = 0; z < seaStart; z++) {
    for (let x = 0; x < width; x++) {
      const surface = grid.getRockHeight(x, z)! + grid.getSandHeight(x, z)!
      grid.setWaterHeight(x, z, surface < seaLevel ? seaLevel - surface : 0)
    }
  }
  return placements
}

// Where a scarp went. Its foot row is the first row below its face; its face
// falls over faceWidth rows above that, and its lip is the last row at full
// height. Outside the notch the raised ground carries on past the face and
// ramps back down over at most `ramp` rows.
export interface ScarpPlacementV2 {
  x0: number
  x1: number
  ramp: number
  footRow(x: number): number
}

// The face's row in each column of the notch, meandering up to
// SCARP_WOBBLE_ROWS either way between turns SCARP_WOBBLE_SPACING apart.
// Outside the notch, the row it would sit at unmeandered.
function footRows(scarp: ScarpV2, x0: number, base: number): (x: number) => number {
  const random = seededRandomV2(scarp.wobble)
  const turns = Array.from({ length: Math.ceil(scarp.span / SCARP_WOBBLE_SPACING) + 1 },
    () => (random() * 2 - 1) * SCARP_WOBBLE_ROWS)
  return (x) => {
    if (x < x0 || x >= x0 + scarp.span) return base
    const at = (x - x0) / SCARP_WOBBLE_SPACING
    const i = Math.floor(at)
    const turn = turns[i]! + (turns[i + 1]! - turns[i]!) * (at - i)
    return base + Math.round(turn)
  }
}

// What each column must be raised by for the surface to fall exactly
// scarp.height from its bare lip to its foot. Outside the notch, the nearest
// notch column's, so the ground behind the face is level across its edges.
function raises(grid: Grid, scarp: ScarpV2, x0: number, footRow: (x: number) => number): Float64Array {
  const x1 = x0 + scarp.span - 1
  const raise = new Float64Array(grid.width)
  for (let x = x0; x <= x1; x++) {
    const foot = footRow(x)
    const lipRock = grid.getRockHeight(x, foot - scarp.faceWidth)!
    raise[x] = Math.max(0, scarp.height - (lipRock - grid.getSurfaceHeight(x, foot)!))
  }
  for (let x = 0; x < grid.width; x++) raise[x] = raise[Math.min(x1, Math.max(x0, x))]!
  return raise
}

// Where a scarp goes on this ground. Its row is a fraction of the rows from
// SCARP_FIRST_ROW to the last that keeps its ramps out of the shore zone. How
// long the ramps run depends on how far the ground must be raised, which
// depends on where the scarp sits, so a scarp whose ramps would reach the
// shore zone moves uphill until they do not.
function placeScarpV2(grid: Grid, scarp: ScarpV2): ScarpPlacementV2 & { raise: Float64Array } {
  const x0 = Math.round(scarp.xCentre * (grid.width - scarp.span))
  const first = SCARP_FIRST_ROW + SCARP_WOBBLE_ROWS
  const limit = grid.seaStart - SHORE_ZONE_ROWS - SCARP_WOBBLE_ROWS
  const rampFor = (raise: number) => Math.ceil(raise / SCARP_SIDE_SLOPE)

  let base = Math.max(first, Math.round(first + scarp.row * (limit - rampFor(scarp.height) - first)))
  for (;;) {
    const footRow = footRows(scarp, x0, base)
    const raise = raises(grid, scarp, x0, footRow)
    const ramp = rampFor(Math.max(...raise))
    const over = base + ramp - limit
    if (over <= 0 || base === first) return { x0, x1: x0 + scarp.span - 1, ramp, footRow, raise }
    base = Math.max(first, base - over)
  }
}

// Cuts a scarp into the ground as it stands. Uphill of its face the rock is
// raised across the whole width; outside the notch the raised ground ramps
// back down seaward, which walls the notch's foot on both sides. The lip, the
// face and a bench behind them are bare rock, and the sand beyond thickens no
// faster than SCARP_SAND_RAMP; beside the walls likewise. The foot keeps its
// sand. A fresh grid holds no moisture, so there is none to move with the sand.
function cutScarpV2(grid: Grid, scarp: ScarpV2, changed: Uint8Array): ScarpPlacementV2 {
  const place = placeScarpV2(grid, scarp)
  const { x0, x1, footRow, raise } = place
  for (let x = 0; x < grid.width; x++) {
    const out = x < x0 ? x0 - x : x > x1 ? x - x1 : 0
    const foot = footRow(x)
    const lip = foot - scarp.faceWidth
    const r = raise[x]!
    for (let z = 0; z < foot; z++) {
      // The face's rows inside the notch fall evenly from the lip to the foot.
      const share = out === 0 && z > lip ? (foot - z) / scarp.faceWidth : 1
      grid.setRockHeight(x, z, grid.getRockHeight(x, z)! + r * share)
      const cap = Math.max(0, (lip - z - SCARP_BENCH + 1 + out) * SCARP_SAND_RAMP)
      if (grid.getSandHeight(x, z)! > cap) grid.setSandHeight(x, z, cap)
      changed[z * grid.width + x] = 1
    }
    if (out === 0) continue
    const cap = Math.max(0, (out - SCARP_BENCH) * SCARP_SAND_RAMP)
    for (let z = foot, k = 1; z < grid.seaStart && r - k * SCARP_SIDE_SLOPE > 0; z++, k++) {
      grid.setRockHeight(x, z, grid.getRockHeight(x, z)! + r - k * SCARP_SIDE_SLOPE)
      if (grid.getSandHeight(x, z)! > cap) grid.setSandHeight(x, z, cap)
      changed[z * grid.width + x] = 1
    }
  }
  return { x0, x1, ramp: place.ramp, footRow }
}

// Trims sand wherever a scarp changed the ground until none stands more than
// SCARP_SETTLE_SLOPE above a neighbour, so Slope finds nothing there to move.
// Lowering a cell can leave the cell uphill of it too steep, so each trim
// passes the check on to its neighbours. Sand only ever goes down, so it ends.
function settleSandV2(grid: Grid, changed: Uint8Array): void {
  const { width, depth } = grid
  const pending: number[] = []
  changed.forEach((flag, i) => { if (flag) pending.push(i) })
  while (pending.length > 0) {
    const i = pending.pop()!
    const x = i % width
    const z = (i - x) / width
    const sand = grid.getSandHeight(x, z)!
    if (sand === 0) continue
    let lowest = Infinity
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
      if (nx >= 0 && nx < width && nz >= 0 && nz < depth) lowest = Math.min(lowest, grid.getSurfaceHeight(nx, nz)!)
    }
    const allowed = Math.max(0, lowest + SCARP_SETTLE_SLOPE - grid.getRockHeight(x, z)!)
    // The layers are float32, so a trim can round back up to just over what
    // it was trimmed to; without the tolerance it would trim the same cell
    // forever. 0.6 leaves 0.025 to spare under repose.
    if (sand <= allowed + SETTLE_TOLERANCE) continue
    grid.setSandHeight(x, z, allowed)
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
      if (nx >= 0 && nx < width && nz >= 0 && nz < depth) pending.push(nz * width + nx)
    }
  }
}

function hashNoise(xi: number, zi: number, seed: number): number {
  let h = ((Math.imul(xi, 374761393) + Math.imul(zi, 668265263)) | 0) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h & 0xffff) / 32767.5 - 1
}

function smoothNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const fx = x - xi
  const fz = z - zi
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hashNoise(xi, zi, seed)
  const b = hashNoise(xi + 1, zi, seed)
  const c = hashNoise(xi, zi + 1, seed)
  const d = hashNoise(xi + 1, zi + 1, seed)
  const ab = a + (b - a) * ux
  const cd = c + (d - c) * ux
  return ab + (cd - ab) * uz
}

function fractalNoise(x: number, z: number, seed: number): number {
  const freqs = [1 / 64, 1 / 32, 1 / 16, 1 / 8]
  const amps  = [1,      0.5,    0.25,   0.125]
  let value = 0
  let total = 0
  for (let o = 0; o < freqs.length; o++) {
    value += smoothNoise(x * freqs[o]!, z * freqs[o]!, seed) * amps[o]!
    total += amps[o]!
  }
  return value / total
}
