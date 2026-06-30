import type { Grid } from '../core/Grid.ts'
import type { Bucket } from '../core/Bucket.ts'

export const ToolMode = {
  Spade: 'spade',
  Dump: 'dump',
  Stream: 'stream',
} as const

export type ToolMode = (typeof ToolMode)[keyof typeof ToolMode]

export const DIG_AMOUNT = 1
export const DUMP_AMOUNT = 1

export function dig(grid: Grid, x: number, z: number, bucket: Bucket): boolean {
  if (bucket.isFull) return false

  const sand = grid.getSandHeight(x, z) ?? 0
  if (sand <= 0) return false

  const actual = Math.min(DIG_AMOUNT, sand)
  grid.setSandHeight(x, z, sand - actual)
  bucket.fill(actual)
  return true
}

export function dump(grid: Grid, x: number, z: number, bucket: Bucket): boolean {
  if (bucket.isEmpty) return false

  const removed = bucket.empty(DUMP_AMOUNT)
  const sand = grid.getSandHeight(x, z) ?? 0
  grid.setSandHeight(x, z, sand + removed)
  return true
}
