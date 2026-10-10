import type { GridCoord } from '../types.ts'

// How many times a second a held button repeats its tool.
export const REPEAT_HZ = 10

// How long the button must be down before repeating starts at all. Keyboard
// auto-repeat works this way and for the same reason: without a threshold the
// repeat begins the instant the button goes down, so an ordinary click pays
// for however many intervals it happens to span. Measured at 60fps before this
// existed - a 50ms tap dug once, 100ms dug twice, 200ms three times, 300ms
// four. It has to sit clear of a slow deliberate click, which runs to ~250ms.
export const HOLD_DELAY = 0.3

// Holding Spade or Dump repeats it, so a trench does not have to be tapped out
// one cell at a time. The repeat is pinned to the cell the button went down on:
// holding drills one hole rather than painting wherever the cursor wanders.
//
// This owes *repeats only*. The application a press itself earns is applied by
// the caller, synchronously, on the way down - see Game.onCellPress. Owing it
// here would route a single tap through the frame loop, where a frame boundary
// can pay it twice and a press and release inside one frame never pays it at
// all. Keeping it out means a tap costs exactly one application by
// construction rather than by timing.
//
// Repeats are an accumulator rather than a timer, driven from Game.loop with
// the same frameSeconds SimClock gets. That keeps them running while the sim is
// paused - digging has always worked paused - and leaves nothing to leak if a
// release is missed. It is also the only part of the press-and-hold path that
// can be tested: Picker and Game both need a browser.
export class ToolRepeater {
  private readonly intervalSeconds: number
  private readonly holdDelaySeconds: number
  private readonly maxFrameSeconds: number
  private pressed: GridCoord | null = null
  private heldSeconds = 0
  private spent = 0

  constructor(ratePerSecond: number, holdDelaySeconds: number, maxFrameSeconds: number) {
    this.intervalSeconds = 1 / ratePerSecond
    this.holdDelaySeconds = holdDelaySeconds
    this.maxFrameSeconds = maxFrameSeconds
  }

  // The cell every repeat applies to, or null while nothing is held.
  get cell(): GridCoord | null {
    return this.pressed
  }

  press(coord: GridCoord): void {
    this.pressed = coord
    this.heldSeconds = 0
    this.spent = 0
  }

  release(): void {
    this.pressed = null
    this.heldSeconds = 0
    this.spent = 0
  }

  // How many repeats the held button owes this frame. The frame is clamped the
  // way SimClock clamps it, because a tab returning from the background hands
  // the loop one enormous frame and that must not empty the bucket into a
  // single cell.
  //
  // Counted from the total time held rather than by draining a remainder: 60fps
  // does not divide the interval, so every repeat falls mid-frame, and whole
  // intervals of the total cannot drift the way a running remainder can.
  due(frameSeconds: number): number {
    if (this.pressed === null) return 0
    this.heldSeconds += Math.min(frameSeconds, this.maxFrameSeconds)

    const earned = this.earnedBy(this.heldSeconds)
    const owed = earned - this.spent
    this.spent = earned
    return owed
  }

  // One repeat the moment the hold delay is reached, then one per interval.
  private earnedBy(heldSeconds: number): number {
    if (heldSeconds < this.holdDelaySeconds) return 0
    return 1 + Math.floor((heldSeconds - this.holdDelaySeconds) / this.intervalSeconds)
  }
}
