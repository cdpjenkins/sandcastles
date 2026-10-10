import type { GridCoord } from '../types.ts'

// How many times a second a held button repeats its tool.
export const REPEAT_HZ = 10

// Holding Spade or Dump repeats it, so a trench does not have to be tapped out
// one cell at a time. The repeat is pinned to the cell the button went down on:
// holding drills one hole rather than painting wherever the cursor wanders.
//
// This is an accumulator rather than a timer, driven from Game.loop with the
// same frameSeconds SimClock gets. That keeps it repeating while the sim is
// paused - digging has always worked paused - and leaves nothing to leak if a
// release is missed. It is also the only part of the press-and-hold path that
// can be tested: Picker and Game both need a browser.
export class ToolRepeater {
  private readonly intervalSeconds: number
  private readonly maxFrameSeconds: number
  private accumulator = 0
  private pressed: GridCoord | null = null

  constructor(ratePerSecond: number, maxFrameSeconds: number) {
    this.intervalSeconds = 1 / ratePerSecond
    this.maxFrameSeconds = maxFrameSeconds
  }

  // The cell every repeat applies to, or null while nothing is held.
  get cell(): GridCoord | null {
    return this.pressed
  }

  // A full interval on the clock, so the very next due() owes the press its
  // first application. A tap that waited 1/10 s to act would feel dead.
  press(coord: GridCoord): void {
    this.pressed = coord
    this.accumulator = this.intervalSeconds
  }

  release(): void {
    this.pressed = null
    this.accumulator = 0
  }

  // How many applications the held button owes this frame. Clamped the way
  // SimClock clamps, because a tab returning from the background hands the loop
  // one enormous frame and that must not empty the bucket into a single cell.
  due(frameSeconds: number): number {
    if (this.pressed === null) return 0
    this.accumulator += Math.min(frameSeconds, this.maxFrameSeconds)
    const count = Math.floor(this.accumulator / this.intervalSeconds)
    this.accumulator -= count * this.intervalSeconds
    return count
  }
}
