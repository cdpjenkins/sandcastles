import type { Grid } from '../core/Grid.ts'

// Higher than any sand slope can stand across one cell's diagonal
// (0.625 x sqrt 2 = 0.88), so only rock faces and freshly cut walls count.
export const FACE_DROP = 1

// Whether a cell's vertex is coloured as water. The mesh has one vertex per
// cell, so a cliff face is a single quad from the lip down to the foot, coloured
// by blending the two. A pool at the foot would paint the whole face blue -
// across the pool's full width, however narrow the stream coming over. So a wet
// cell under a face shows its water only if water comes over that face: one of
// the neighbours standing above its water surface by FACE_DROP is wet too.
export function showsWater(grid: Grid, x: number, z: number): boolean {
  const water = grid.getWaterHeight(x, z) ?? 0
  if (water <= 0) return false
  const top = (grid.getSurfaceHeight(x, z) ?? 0) + water
  let underFace = false
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue
      const ground = grid.getSurfaceHeight(x + dx, z + dz)
      if (ground === undefined || ground - top <= FACE_DROP) continue
      if ((grid.getWaterHeight(x + dx, z + dz) ?? 0) > 0) return true
      underFace = true
    }
  }
  return !underFace
}
