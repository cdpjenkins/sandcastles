import type { Grid } from '../core/Grid.ts'

// Erosion ignores a dry cell, so whatever its water was still carrying would
// sit in it forever. Water is what held it up; with the water gone it settles.
export const settleSediment = (grid: Grid, x: number, z: number): void => {
  const sediment = grid.getSediment(x, z) ?? 0
  if (sediment > 0) {
    grid.setSandHeight(x, z, (grid.getSandHeight(x, z) ?? 0) + sediment)
    grid.setSediment(x, z, 0)
  }
}
