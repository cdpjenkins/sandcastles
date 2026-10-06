import type { Grid } from '../core/Grid.ts'

export interface SourceCell {
  readonly x: number
  readonly z: number
  readonly rate: number
}

// Scanned rather than tracked: source is a plain layer that the Stream tool,
// resetWater, an import, a new game and a restore all write to, so a list kept
// alongside it would have five places to fall out of step with the grid. The
// grid is the single source of truth and this reads it.
export function getSources(grid: Grid): SourceCell[] {
  const sources: SourceCell[] = []
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      const rate = grid.getSourceRate(x, z) ?? 0
      if (rate !== 0) sources.push({ x, z, rate })
    }
  }
  return sources
}
