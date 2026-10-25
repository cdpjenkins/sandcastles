import type { Grid } from '../Grid.ts'
import type { BeachSeed } from '../BeachSeed.ts'
import { beachGeneratorV1 } from './v1/BeachGeneratorV1.ts'

// A way of growing a beach. Each is frozen once shipped: a save records the
// generator that built it, and a seed must regenerate the same beach forever.
// A change to how beaches grow is a new generator beside the old ones.
export interface BeachGenerator {
  readonly version: number
  // Whether this generator has a classic beach, grown from no seed at all.
  // Classic is a v1 idea; a later generator has none to offer.
  readonly hasClassic: boolean
  // Lays out sea, rock, sand, water and the spring on a fresh grid.
  generate(grid: Grid, seed: BeachSeed): void
}

// What a beach is grown from: which generator, and which seed.
export interface BeachSpec {
  generator: number
  seed: BeachSeed
}

const GENERATORS: readonly BeachGenerator[] = [beachGeneratorV1]

// What a new random or typed seed is grown with.
export const LATEST_GENERATOR = 1

export const CLASSIC_BEACH: Readonly<BeachSpec> = Object.freeze({ generator: 1, seed: null })

// null for a version this game does not have - a save from a newer game, or a
// corrupt one - for the caller to refuse.
export function generatorFor(version: number): BeachGenerator | null {
  return GENERATORS.find((generator) => generator.version === version) ?? null
}
