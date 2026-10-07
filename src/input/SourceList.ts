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

// The Stream tool sets one cell per pick, so a dragged tool leaves hundreds
// behind. The panel lists this many and then says how many it did not, which
// keeps the heading's count - the part worth reading on a long list - on screen.
export const MAX_LISTED = 20

export function formatSourceList(sources: readonly SourceCell[]): string {
  const heading = `Sources (${sources.length})`
  const rule = '─'.repeat(heading.length)

  // An empty list is what a fresh beach shows, which is the one case that
  // cannot explain itself, so it says what to do instead of nothing.
  if (sources.length === 0) {
    return [heading, rule, 'None - pick the Stream tool and click the sand'].join('\n')
  }

  const lines = sources
    .slice(0, MAX_LISTED)
    .map(({ x, z, rate }) => `(${pad(x)}, ${pad(z)})  rate ${rate.toFixed(2)}`)
  const hidden = sources.length - lines.length
  if (hidden > 0) lines.push(`… and ${hidden} more`)

  return [heading, rule, ...lines].join('\n')
}

// Padded to the widest coordinate this grid can hold, so the rates line up
// into a column rather than stepping in and out with the digit count.
function pad(value: number): string {
  return String(value).padStart(3)
}
