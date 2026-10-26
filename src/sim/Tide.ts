import type { Grid } from '../core/Grid.ts'

export interface TideSnapshot {
  elapsed: number
}

// The tide's clock. Its amplitude and period are the beach's, and live on the
// grid with the rest of its sea, so a beach carries its own tide through a save
// and this holds only where in the cycle it is.
export class Tide {
  private elapsed = 0

  snapshot(): TideSnapshot {
    return { elapsed: this.elapsed }
  }

  restore(snapshot: TideSnapshot): void {
    this.elapsed = snapshot.elapsed
  }

  step(dt: number): void {
    this.elapsed += dt
  }

  // How far above the beach's sea level the tide has the sea right now.
  offset(grid: Grid): number {
    const { tideAmplitude, tidePeriod } = grid.sea
    return tideAmplitude * Math.sin((2 * Math.PI * this.elapsed) / tidePeriod)
  }
}
