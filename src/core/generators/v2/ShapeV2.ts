import { seedFromText } from '../../BeachSeed.ts'
import { seededRandomV2 } from './RandomV2.ts'

// What a v2 seed chooses about its beach beyond the noise: its sea, tide and
// swell, the shape of its ridge, how much of it is sand, how bold its land is,
// and its scarps. Part of v2: once it ships, every range here and the order of
// the draws are frozen with it.
//
// The ranges were set by v2's sweep (PLAN.md step 12).

// A rock cliff far steeper than sand can stand, cut as a notch so the water
// falling over it is walled in at the foot. Where it goes is stored as
// fractions, so the shape does not depend on the grid it is laid on: the
// generator turns them into rows and columns.
export interface ScarpV2 {
  row: number        // 0 - 1 across the rows a scarp may use, back to front
  xCentre: number    // 0 - 1 across the width
  span: number       // the notch's width in cells
  height: number     // the surface drop, lip to foot
  faceWidth: number  // cells the drop falls over: 1 or 2
  wobble: number     // seed for the face's meander across the notch
}

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
  scarps: ScarpV2[]
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
const MAX_SCARPS = 2
const SCARP_SPAN = [10, 40] as const
const SCARP_HEIGHT = [3, 10] as const
const SCARP_FACE_WIDTH = [1, 2] as const

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
  const whole = ([lo, hi]: readonly [number, number]) => lo + Math.floor(random() * (hi - lo + 1))

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

  const scarps: ScarpV2[] = []
  const count = whole([0, MAX_SCARPS])
  for (let i = 0; i < count; i++) {
    const row = random()
    const xCentre = random()
    const span = whole(SCARP_SPAN)
    const height = between(SCARP_HEIGHT)
    const faceWidth = whole(SCARP_FACE_WIDTH)
    const wobble = Math.floor(random() * 2 ** 32)
    scarps.push({ row, xCentre, span, height, faceWidth, wobble })
  }

  return {
    seaFraction, seaLevel, tideAmplitude, tidePeriod, swellFrequency, swellStrength,
    ridgeScale, ridgePower, sandShare, noiseScale, scarps,
  }
}
