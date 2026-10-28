import { seedFromText } from '../../BeachSeed.ts'
import { seededRandomV2 } from './RandomV2.ts'

// What a v2 seed chooses about its beach beyond the noise: its sea, tide and
// swell, the shape of its ridge, how much of it is sand, and how bold its land
// is. FROZEN with the rest of v2: every range here and the order of the draws.
//
// v2 once drew up to two scarps - rock cliffs that made waterfalls - after
// everything else. They were taken out before v2 was pushed; because they were
// the last draws, no other value moved. PLAN.md keeps their design.
//
// The ranges were set by v2's sweep (PLAN.md step 12).

export interface ShapeV2 {
  seaFraction: number    // seaStart = floor(depth * seaFraction)
  seaLevel: number       // an elevation
  tideAmplitude: number  // high water is seaLevel + tideAmplitude
  tidePeriod: number     // seconds
  swellFrequency: number // fraction of the maximum swell's
  swellStrength: number  // fraction of the maximum swell's
  ridgeScale: number     // multiplies v1's surface ridge, rock + sand
  ridgePower: number     // ridge = (1 - t) ** ridgePower; v1 is 2
  sandShare: number      // fraction of the ridge that is sand; v1 is 9/21
  noiseScale: number     // multiplies v1's rock and sand noise amplitudes
}

const SEA_FRACTION = [0.74, 0.80] as const
const SEA_LEVEL = [1.6, 2.4] as const
const TIDE_AMPLITUDE = [0.4, 1.4] as const
const TIDE_PERIOD = [180, 360] as const
const SWELL_FREQUENCY = [0.78, 1] as const
const SWELL_STRENGTH = [0.5, 1] as const
const RIDGE_SCALE = [0.7, 1.3] as const
const RIDGE_POWER = [1.5, 2.5] as const
const SAND_SHARE = [0.25, 0.65] as const
const NOISE_SCALE = [1.0, 1.6] as const

// The shape a seed grows. Trimmed as noiseSeed trims, or the same land would
// grow under a different shape; drawn from a stream of its own, so the shape
// and the spring take nothing from each other.
export function shapeV2(seed: string): ShapeV2 {
  return drawShapeV2(seededRandomV2(seedFromText(`${seed.trim()}:shape`)))
}

// The draws, in their frozen order. Every value is one draw, so the order is
// the order of these lines.
export function drawShapeV2(random: () => number): ShapeV2 {
  const between = ([lo, hi]: readonly [number, number]) => lo + random() * (hi - lo)

  const seaFraction = between(SEA_FRACTION)
  const seaLevel = between(SEA_LEVEL)
  const tideAmplitude = between(TIDE_AMPLITUDE)
  const tidePeriod = between(TIDE_PERIOD)
  const swellFrequency = between(SWELL_FREQUENCY)
  const swellStrength = between(SWELL_STRENGTH)
  const ridgeScale = between(RIDGE_SCALE)
  const ridgePower = between(RIDGE_POWER)
  const sandShare = between(SAND_SHARE)
  const noiseScale = between(NOISE_SCALE)

  return {
    seaFraction, seaLevel, tideAmplitude, tidePeriod, swellFrequency, swellStrength,
    ridgeScale, ridgePower, sandShare, noiseScale,
  }
}
