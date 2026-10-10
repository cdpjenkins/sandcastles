import { describe, it, expect } from 'vitest'
import { ToolRepeater } from './ToolRepeater.ts'

const RATE = 10
const INTERVAL = 1 / RATE
const DELAY = 0.3
const MAX_FRAME = 0.1
const FRAME = 1 / 60

// A ToolRepeater owes *repeats* and nothing else. The application a press
// itself earns is applied synchronously by the caller, so a tap cannot be
// doubled by a frame boundary or lost by a press and release inside one frame.
const pressed = (maxFrame = MAX_FRAME) => {
  const repeater = new ToolRepeater(RATE, DELAY, maxFrame)
  repeater.press({ x: 10, z: 20 })
  return repeater
}

// What a hold of this long owes, spent one 60fps frame at a time - which is how
// Game.loop spends it, and the only way a timing bug smaller than a frame shows.
const repeatsWhileHolding = (seconds: number, maxFrame = MAX_FRAME): number => {
  const repeater = pressed(maxFrame)
  let total = 0
  for (let t = 0; t < seconds; t += FRAME) total += repeater.due(FRAME)
  return total
}

describe('ToolRepeater', () => {
  it('owes nothing while no button is held', () => {
    const repeater = new ToolRepeater(RATE, DELAY, MAX_FRAME)

    expect(repeater.due(1)).toBe(0)
  })

  it('owes nothing for the press itself', () => {
    // The press's own dig is the caller's, applied the moment the button goes
    // down. Owing it here instead would route a single tap through the frame
    // loop, where it can be paid twice or - for a press and release inside one
    // frame - never paid at all.
    expect(pressed().due(0)).toBe(0)
  })

  it('reports the pressed cell', () => {
    expect(pressed().cell).toEqual({ x: 10, z: 20 })
  })

  describe('a tap shorter than the hold delay owes no repeat', () => {
    // The bug this was written for: the repeat used to begin the instant the
    // button went down, so a tap paid for however many intervals it happened to
    // span. A 100ms click - an ordinary one - dug twice, and 300ms dug four
    // times. Only a hold past the delay may repeat.
    for (const tapMs of [0, 16, 50, 100, 150, 200, 250, 280]) {
      it(`a ${tapMs}ms tap`, () => {
        expect(repeatsWhileHolding(tapMs / 1000)).toBe(0)
      })
    }
  })

  it('is accurate to one frame at the threshold, not better', () => {
    // The hold is measured by adding up frame deltas, and the press lands
    // wherever it lands inside a frame - so the first frame counts time before
    // the button went down, and a hold can read up to one frame long. A tap
    // within a frame of the delay may therefore earn its first repeat. 16ms of
    // slop on a 300ms threshold is the price of counting frames instead of
    // reading a clock, and reading a clock would be worse: a backgrounded tab
    // would come back having "held" for minutes.
    expect(repeatsWhileHolding(DELAY - FRAME * 0.5)).toBe(1)
  })

  it('owes nothing until the hold delay has passed', () => {
    expect(pressed().due(DELAY * 0.9)).toBe(0)
  })

  it('owes its first repeat once the hold delay has passed', () => {
    // Spent in frames, because a single frame as long as the delay would be
    // clipped by the stalled-frame clamp below - 0.3s against MAX_FRAME's 0.1.
    expect(repeatsWhileHolding(DELAY + FRAME)).toBe(1)
  })

  it('repeats at the rate once the delay is behind it', () => {
    expect(repeatsWhileHolding(DELAY + INTERVAL * 3)).toBe(1 + 3)
  })

  it('does not lose a repeat to frames that straddle the interval', () => {
    // 60fps does not divide 1/10, so a repeat falls mid-frame every time.
    // Counting whole intervals of the total hold is what keeps it exact: a
    // second of holding past the delay owes exactly RATE repeats.
    expect(repeatsWhileHolding(DELAY + 1)).toBe(1 + RATE)
  })

  it('repeats faster at a higher rate', () => {
    // The rate is the configurable part, so a test has to be able to move it.
    const fast = new ToolRepeater(RATE * 2, DELAY, MAX_FRAME)
    fast.press({ x: 10, z: 20 })
    let total = 0
    for (let t = 0; t < DELAY + INTERVAL; t += FRAME) total += fast.due(FRAME)

    expect(total).toBe(1 + 2)
  })

  it('cannot burst after a stalled frame', () => {
    // A tab coming back from the background hands the loop one enormous frame.
    // Clamping it the way SimClock does is what stops that emptying the bucket
    // into a single cell. The clamp is set wider than the delay here, so the
    // reading is the clamp rather than the delay swallowing the frame.
    const repeater = pressed(DELAY + INTERVAL * 2)

    expect(repeater.due(10)).toBe(1 + 2)
  })

  it('owes nothing after a release', () => {
    const repeater = pressed()

    repeater.release()

    expect(repeater.due(DELAY + INTERVAL * 5)).toBe(0)
  })

  it('forgets the cell on a release', () => {
    const repeater = pressed()

    repeater.release()

    expect(repeater.cell).toBeNull()
  })

  it('starts a fresh hold on the next press', () => {
    // Otherwise a run of quick taps would accumulate towards a repeat that no
    // single tap was held long enough to earn.
    const repeater = pressed()
    repeater.due(DELAY * 0.9)
    repeater.release()

    repeater.press({ x: 1, z: 2 })

    expect(repeater.due(DELAY * 0.9)).toBe(0)
  })

  it('a second press moves the cell', () => {
    const repeater = pressed()
    repeater.release()

    repeater.press({ x: 1, z: 2 })

    expect(repeater.cell).toEqual({ x: 1, z: 2 })
  })
})
