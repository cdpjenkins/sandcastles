import { STREAM_RATE } from '../../Grid.ts'
import type { Grid } from '../../Grid.ts'
import { noiseSeed } from '../../BeachSeed.ts'
import type { BeachSeed } from '../../BeachSeed.ts'
import { springSite } from '../../SpringSite.ts'

// Version 1 of the beach generator. FROZEN.
//
// Every save records the generator that built its beach, and a seed must
// regenerate the same beach forever - for Restart, and for a seed someone has
// shared. So nothing here may change, not a constant and not the order of an
// operation. A change to how beaches grow goes into a new generator beside
// this one, copying whatever it wants to alter.
//
// Held by beachPins.test.ts, which checksums every layer of three beaches, and
// by the classic rock and sand checksums in beachGeneratorV1.test.ts.

const SEA_FRACTION = 0.78
const ROCK_BASE_HEIGHT = 1.0
const SEA_WATER_HEIGHT = 1.0
const ROCK_RIDGE_AMPLITUDE = 12
const ROCK_NOISE_AMPLITUDE = 12
const ROCK_NOISE_OFFSET = 1000
const MIN_ROCK_HEIGHT = 0.2
const ROCK_SHORE_FADE_DISTANCE = 25
const SAND_RIDGE_AMPLITUDE = 9
const SAND_NOISE_AMPLITUDE = 6
const SEA_FLOOR_END_HEIGHT = -20

// A whole v1 beach: the sea, the land and the spring. Classic (null) keeps the
// spring everything was tuned with; a seeded beach puts its own where its water
// will reach the sea.
export function generateBeachV1(grid: Grid, seed: BeachSeed): void {
  grid.setSea(Math.floor(grid.depth * SEA_FRACTION), ROCK_BASE_HEIGHT + SEA_WATER_HEIGHT)
  layBeachV1(grid, noiseSeed(seed))
  if (seed === null) {
    placeClassicSpringV1(grid, STREAM_RATE)
  } else {
    const site = springSite(grid, seed)
    grid.setSourceRate(site.x, site.z, STREAM_RATE)
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
export function layBeachV1(grid: Grid, seed: number = 0): void {
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

// The classic spring: top-centre, a few rows in from the back of the beach.
export function placeClassicSpringV1(grid: Grid, rate: number): void {
  const x = Math.floor(grid.width / 2)
  const z = Math.floor(grid.seaStart * 0.01)
  grid.setSourceRate(x, z, rate)
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
