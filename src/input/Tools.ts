import type { Grid } from '../core/Grid.ts'
import type { Bucket } from '../core/Bucket.ts'
import { moistureAfterDrySand } from '../sim/Moisture.ts'

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

  const added = bucket.fill(Math.min(DIG_AMOUNT, sand))
  grid.setSandHeight(x, z, sand - added)
  return true
}

export function dump(grid: Grid, x: number, z: number, bucket: Bucket): boolean {
  if (bucket.isEmpty) return false

  const removed = bucket.empty(DUMP_AMOUNT)
  const sand = grid.getSandHeight(x, z) ?? 0
  grid.setSandHeight(x, z, sand + removed)
  // Sand from the bucket is dry, and lies on top of whatever was damp.
  grid.setMoisture(x, z, moistureAfterDrySand(grid.getMoisture(x, z) ?? 0, sand, removed))
  return true
}

// Whether holding the button down should keep applying this tool. Spade and
// Dump repeat; Stream places one source per click, since a repeat on the
// pressed cell achieves nothing and the tool is the one that can flood the
// beach by accident.
export function repeatsOnHold(mode: ToolMode): boolean {
  return mode === ToolMode.Spade || mode === ToolMode.Dump
}
