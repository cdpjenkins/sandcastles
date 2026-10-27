import type { Grid } from '../../Grid.ts'
import { noiseSeed } from '../../BeachSeed.ts'
import type { BeachSeed } from '../../BeachSeed.ts'
import { springSiteV2 } from './SpringSiteV2.ts'
import { shapeV2 } from './ShapeV2.ts'
import type { ShapeV2 } from './ShapeV2.ts'
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
const ROCK_RIDGE_AMPLITUDE = 12
const ROCK_NOISE_AMPLITUDE = 12
const ROCK_NOISE_OFFSET = 1000
const MIN_ROCK_HEIGHT = 0.2
const ROCK_SHORE_FADE_DISTANCE = 25
const SAND_RIDGE_AMPLITUDE = 9
const SAND_NOISE_AMPLITUDE = 6
const SEA_FLOOR_END_HEIGHT = -20
// v1's swell, until v2 seeds its own.
const SWELL_FREQUENCY = 1
const SWELL_STRENGTH = 1

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
  layBeachV2(grid, noiseSeed(seed))
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
    swellFrequency: SWELL_FREQUENCY,
    swellStrength: SWELL_STRENGTH,
  }
}

// The land and the sea bed, with water up to sea level wherever the ground is
// below it. Lays out against the grid's sea as it stands.
//
// The seed varies only the land's noise. Seed 0 is the classic beach: it is
// XORed into the hash, so 0 leaves every value as it always was.
//
// Each cell is written and then read back before use, so the arithmetic sees
// the same float32-rounded values the layers hold.
export function layBeachV2(grid: Grid, seed: number = 0): void {
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
        const ridge = Math.pow(1 - t, 2)

        const distFromSea = seaStart - z
        const shoreFade = Math.min(1, distFromSea / ROCK_SHORE_FADE_DISTANCE)
        const rockNoise = fractalNoise(x + ROCK_NOISE_OFFSET, z + ROCK_NOISE_OFFSET, seed) * ROCK_NOISE_AMPLITUDE
        const unfadedRock = ROCK_BASE_HEIGHT + ROCK_RIDGE_AMPLITUDE * ridge + rockNoise
        grid.setRockHeight(x, z, shoreFade < 1 ? unfadedRock * shoreFade : Math.max(MIN_ROCK_HEIGHT, unfadedRock))

        const base = SAND_RIDGE_AMPLITUDE * ridge
        const noise = fractalNoise(x, z, seed) * SAND_NOISE_AMPLITUDE
        grid.setSandHeight(x, z, Math.max(0, (base + noise) * shoreFade))

        const surface = grid.getRockHeight(x, z)! + grid.getSandHeight(x, z)!
        grid.setWaterHeight(x, z, surface < seaLevel ? seaLevel - surface : 0)
      }
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
