# WIP: Press and hold to dig or dump

Tapping repeatedly to dig is the complaint. Holding the button should repeat
the active tool at a configurable rate, 10/s by default.

Decided, with the options that were weighed:

- **Driven from the frame loop**, by a `ToolRepeater` sibling of `SimClock`:
  `Game.loop` already has `frameSeconds`. A pure accumulator, so it is
  unit-testable where `Picker` and `Game` are not, it leaks no timer, and it
  keeps repeating while the sim is paused - digging works paused today.
  `setInterval` was rejected (throttled in a backgrounded tab, needs fake
  timers, leaks on a missed release); counting sim steps was rejected (it
  would stop digging while the game is paused).
- **Pinned to the press cell**, not following the cursor: holding drills one
  hole or builds one pile wherever the button went down.
- **`REPEAT_HZ = 10`** as a named constant beside `DIG_AMOUNT`.
- **Stream does not repeat.** One click, one source.

The first application lands on the press itself, so the tool still feels
instant; the repeats follow at 1/10 s.

Two traps this has to clear: the trigger moves from `click` to `mousedown`
(keeping both would dig twice per press), and the release must be heard on
`window` - a mouseup off the canvas would otherwise leave it digging forever.

## Current Step

Step 2: `Picker` hears press and release; `Game.loop` spends what the
repeater owes.

## Status

⏸️ WAITING - step 1 committed, suite green (404), tsc clean.

## Completed

- [x] Step 1: `ToolRepeater` - press owes the first application at once,
      repeats at `REPEAT_HZ`, carries a part-interval across frames, clamps a
      stalled frame so it cannot burst, and forgets both cell and accumulator
      on a release. 13 tests; the clamp one mutation-verified.

## Shipped before this

- A toolbar that fits the screen (`be91f10`..`6f3e113`).
