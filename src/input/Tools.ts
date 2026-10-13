import type { Grid } from '../core/Grid.ts'
import type { Bucket } from '../core/Bucket.ts'

export const ToolMode = {
  Spade: 'spade',
  Dump: 'dump',
  Stream: 'stream',
} as const

export type ToolMode = (typeof ToolMode)[keyof typeof ToolMode]

export const DIG_AMOUNT = 10
export const DUMP_AMOUNT = 10

export function dig(grid: Grid, x: number, z: number, bucket: Bucket): boolean {
  if (bucket.isFull) return false

  const sand = grid.getSandHeight(x, z) ?? 0
  if (sand <= 0) return false

  // The water is spread evenly through the sand, so a spadeful takes its
  // share of it into the bucket.
  const moisture = grid.getMoisture(x, z) ?? 0
  const waterPerSand = moisture / sand
  const added = bucket.fill(Math.min(DIG_AMOUNT, sand), waterPerSand)
  grid.setSandHeight(x, z, sand - added)
  grid.setMoisture(x, z, Math.max(0, moisture - added * waterPerSand))
  return true
}

export function dump(grid: Grid, x: number, z: number, bucket: Bucket): boolean {
  if (bucket.isEmpty) return false

  const waterBefore = bucket.water
  const removed = bucket.empty(DUMP_AMOUNT)
  const sand = grid.getSandHeight(x, z) ?? 0
  grid.setSandHeight(x, z, sand + removed)
  // The poured sand brings its water, which mixes evenly through the cell.
  grid.setMoisture(x, z, (grid.getMoisture(x, z) ?? 0) + waterBefore - bucket.water)
  return true
}

// Whether holding the button down should keep applying this tool. Spade and
// Dump repeat; Stream places one source per click, since a repeat on the
// pressed cell achieves nothing and the tool is the one that can flood the
// beach by accident.
export function repeatsOnHold(mode: ToolMode): boolean {
  return mode === ToolMode.Spade || mode === ToolMode.Dump
}
