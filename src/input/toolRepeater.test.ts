import { describe, it, expect } from 'vitest'
import { ToolRepeater } from './ToolRepeater.ts'

const RATE = 10
const INTERVAL = 1 / RATE
const MAX_FRAME = 0.1

const held = () => {
  const repeater = new ToolRepeater(RATE, MAX_FRAME)
  repeater.press({ x: 10, z: 20 })
  // The press itself owes the first application. Drain it, so what each test
  // below measures is the repeat rather than that.
  repeater.due(0)
  return repeater
}

describe('ToolRepeater', () => {
  it('owes nothing while no button is held', () => {
    const repeater = new ToolRepeater(RATE, MAX_FRAME)

    expect(repeater.due(1)).toBe(0)
  })

  it('owes the first application on the press itself', () => {
    // Not after an interval: a tap has to act at once or the tool feels dead.
    const repeater = new ToolRepeater(RATE, MAX_FRAME)
    repeater.press({ x: 10, z: 20 })

    expect(repeater.due(0)).toBe(1)
  })

  it('reports the pressed cell', () => {
    const repeater = held()

    expect(repeater.cell).toEqual({ x: 10, z: 20 })
  })

  it('owes nothing again until the interval has passed', () => {
    const repeater = held()

    expect(repeater.due(INTERVAL * 0.6)).toBe(0)
  })

  it('owes one more once the interval has passed', () => {
    const repeater = held()

    expect(repeater.due(INTERVAL)).toBe(1)
  })

  it('carries the leftover of a short frame into the next', () => {
    const repeater = held()

    repeater.due(INTERVAL * 0.6)

    expect(repeater.due(INTERVAL * 0.6)).toBe(1)
  })

  it('owes the whole run of a frame longer than one interval', () => {
    const repeater = new ToolRepeater(RATE, MAX_FRAME * 10)
    repeater.press({ x: 10, z: 20 })
    repeater.due(0)

    expect(repeater.due(INTERVAL * 3)).toBe(3)
  })

  it('repeats faster at a higher rate', () => {
    // The rate is the configurable part, so a test has to be able to move it.
    const repeater = new ToolRepeater(RATE * 2, MAX_FRAME)
    repeater.press({ x: 10, z: 20 })
    repeater.due(0)

    expect(repeater.due(INTERVAL)).toBe(2)
  })

  it('cannot burst after a stalled frame', () => {
    // A tab coming back from the background hands the loop one enormous frame.
    // Clamping it the way SimClock does is what stops that emptying the bucket
    // into a single cell. The clamp here is three intervals wide rather than
    // MAX_FRAME's one, so the answer differs from an ordinary frame's and this
    // can tell the clamp from the normal path.
    const repeater = new ToolRepeater(RATE, INTERVAL * 3)
    repeater.press({ x: 10, z: 20 })
    repeater.due(0)

    expect(repeater.due(10)).toBe(3)
  })

  it('owes nothing after a release', () => {
    const repeater = held()

    repeater.release()

    expect(repeater.due(INTERVAL * 5)).toBe(0)
  })

  it('forgets the cell on a release', () => {
    const repeater = held()

    repeater.release()

    expect(repeater.cell).toBeNull()
  })

  it('does not carry a part-spent interval across a release', () => {
    // Otherwise a run of quick taps would fire a repeat that was never held
    // for long enough to earn one.
    const repeater = held()
    repeater.due(INTERVAL * 0.9)
    repeater.release()

    repeater.press({ x: 1, z: 2 })
    repeater.due(0)

    expect(repeater.due(INTERVAL * 0.2)).toBe(0)
  })

  it('a second press moves the cell', () => {
    const repeater = held()
    repeater.release()

    repeater.press({ x: 1, z: 2 })

    expect(repeater.cell).toEqual({ x: 1, z: 2 })
  })
})
