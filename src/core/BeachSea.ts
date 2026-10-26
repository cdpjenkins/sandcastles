// A beach's sea: where it starts, how high it stands, its tide and its swell.
// One value per beach, held by the grid, set by whatever lays the beach out.
//
// The tide is a property of the place and is stored absolute. The swell is
// stored as fractions of the harshest swell anything was tuned with -
// SWELL_PERIOD and SWELL_AMPLITUDE in Waves - so retuning those knobs moves
// every beach together, and no beach is ever harsher than the tuning.
export interface BeachSea {
  seaStart: number        // the first row of sea
  seaLevel: number        // an elevation, never a depth
  tideAmplitude: number   // high water is seaLevel + tideAmplitude
  tidePeriod: number      // seconds
  swellFrequency: number  // fraction of the maximum; period = SWELL_PERIOD / this
  swellStrength: number   // fraction of the maximum; amplitude = SWELL_AMPLITUDE * this
}

// The sea every beach had before generators chose their own. A grid built
// without a generator keeps it, so every test grid behaves as it always has.
// v1 states the same values from constants of its own.
const DEFAULT_SEA_FRACTION = 0.78
const DEFAULT_SEA_LEVEL = 2.0
const DEFAULT_TIDE_AMPLITUDE = 0.8
const DEFAULT_TIDE_PERIOD = 180

export function defaultSea(depth: number): BeachSea {
  return {
    seaStart: Math.floor(depth * DEFAULT_SEA_FRACTION),
    seaLevel: DEFAULT_SEA_LEVEL,
    tideAmplitude: DEFAULT_TIDE_AMPLITUDE,
    tidePeriod: DEFAULT_TIDE_PERIOD,
    swellFrequency: 1,
    swellStrength: 1,
  }
}

// What is wrong with a sea on a grid this deep, or null if nothing is. The one
// definition of a sea a beach may have, so the grid and the save cannot drift
// apart. At least one row of land and one of sea, so neither the beach nor the
// swell is left with nowhere to be.
export function seaProblem(sea: BeachSea, depth: number): string | null {
  const { seaStart, seaLevel, tideAmplitude, tidePeriod, swellFrequency, swellStrength } = sea
  if (!Number.isInteger(seaStart) || seaStart < 1 || seaStart >= depth) {
    return `sea must start on a row inside the grid, not ${seaStart}`
  }
  if (!Number.isFinite(seaLevel)) return `sea level must be a number, not ${seaLevel}`
  if (!Number.isFinite(tideAmplitude) || tideAmplitude < 0) {
    return `tide amplitude must be a number at least 0, not ${tideAmplitude}`
  }
  if (!Number.isFinite(tidePeriod) || tidePeriod <= 0) {
    return `tide period must be a number above 0, not ${tidePeriod}`
  }
  if (!(swellFrequency > 0 && swellFrequency <= 1)) {
    return `swell frequency must be above 0 and at most 1, not ${swellFrequency}`
  }
  if (!(swellStrength >= 0 && swellStrength <= 1)) {
    return `swell strength must be from 0 to 1, not ${swellStrength}`
  }
  return null
}
