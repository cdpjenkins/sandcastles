import { describe, it, expect } from 'vitest'
import { SimClock } from './SimClock.ts'

const STEP = 1 / 30
const MAX_FRAME = 0.1

describe('SimClock', () => {
  it('runs one step for a frame exactly one step long', () => {
    const clock = new SimClock(STEP, MAX_FRAME)

    expect(clock.advance(STEP)).toBe(1)
  })

  it('runs nothing for a frame shorter than one step', () => {
    const clock = new SimClock(STEP, MAX_FRAME)

    expect(clock.advance(STEP * 0.6)).toBe(0)
  })

  it('carries the leftover of a short frame into the next one', () => {
    const clock = new SimClock(STEP, MAX_FRAME)

    clock.advance(STEP * 0.6)

    expect(clock.advance(STEP * 0.6)).toBe(1)
  })

  it('runs three steps for a frame three steps long', () => {
    const clock = new SimClock(STEP, MAX_FRAME)

    expect(clock.advance(STEP * 3)).toBe(3)
  })

  it('clamps a long frame rather than trying to catch the whole of it up', () => {
    // A tab left in the background hands back one enormous frame. Running every
    // step of it would lock the page, so the clock takes MAX_FRAME of it and
    // lets the rest go: the simulation slows down rather than freezing.
    const clock = new SimClock(STEP, MAX_FRAME)

    expect(clock.advance(60)).toBe(Math.floor(MAX_FRAME / STEP))
  })
})
