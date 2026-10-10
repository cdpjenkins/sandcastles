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

Step 4: a tap must cost exactly one application.

`press()` primed the accumulator with a full interval, so the repeat began
the instant the button went down and a tap paid for however many intervals
it happened to span. Measured at 60fps: a 50ms tap digs once, **100ms digs
twice**, 200ms three times, 300ms four. An ordinary click was digging twice.

So the repeat needs a threshold, the way keyboard auto-repeat does:
`HOLD_DELAY` of 0.3s before the first repeat, then `REPEAT_HZ`. A tap
shorter than the delay earns exactly one application however many frames it
spans.

## Status

🟢 GREEN - 22 repeater tests, suite green (416), tsc clean, build clean.

Measured end to end with a real Grid and Bucket, digs per hold: 0ms 1,
16ms 1, 50ms 1, 100ms 1, 200ms 1, 250ms 1, 300ms 2, 500ms 4, 1s 9, 2s 19.

Browser check still outstanding: nothing in the suite can press a mouse
button, so the feel of the hold and the off-canvas release want trying by
hand.

## Completed

- [x] Step 1: `ToolRepeater` - press owes the first application at once,
      repeats at `REPEAT_HZ`, carries a part-interval across frames, clamps a
      stalled frame so it cannot burst, and forgets both cell and accumulator
      on a release. 13 tests; the clamp one mutation-verified.
- [x] Step 2: `Picker` fires on `mousedown` and hears `mouseup`/`blur` on the
      window; `Game.loop` spends what the repeater owes. `repeatsOnHold` keeps
      the which-tools-repeat branch out of untestable `Game`.
- [x] Step 3: docs. README's controls and tree, the `?` overlay, and
      CLAUDE.md on the window-release trap, why an accumulator beats a timer,
      the stalled-frame clamp, why `click` and `mousedown` cannot both fire,
      the untestable feel, and the bucket arithmetic that caps a held Spade
      at a second.

## Shipped before this

- A toolbar that fits the screen (`be91f10`..`6f3e113`).
