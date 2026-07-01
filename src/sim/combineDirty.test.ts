import { describe, it, expect } from 'vitest'
import { orInto } from './combineDirty.ts'

describe('orInto', () => {
  it('sets bits from disjoint sources', () => {
    const target = new Uint8Array(4)
    const a = Uint8Array.from([1, 0, 0, 0])
    const b = Uint8Array.from([0, 0, 1, 0])

    orInto(target, a, b)

    expect(Array.from(target)).toEqual([1, 0, 1, 0])
  })

  it('does not double-count an index set in multiple sources', () => {
    const target = new Uint8Array(4)
    const a = Uint8Array.from([1, 0, 0, 0])
    const b = Uint8Array.from([1, 0, 0, 0])

    orInto(target, a, b)

    expect(target[0]).toBe(1)
  })

  it('leaves an all-zero target when all sources are all-zero', () => {
    const target = new Uint8Array(4)
    const a = new Uint8Array(4)
    const b = new Uint8Array(4)

    orInto(target, a, b)

    expect(Array.from(target).every(v => v === 0)).toBe(true)
  })

  it('re-zeroes the target so bits from a previous call do not leak', () => {
    const target = new Uint8Array(4)
    orInto(target, Uint8Array.from([1, 1, 1, 1]))

    orInto(target, Uint8Array.from([0, 0, 0, 0]))

    expect(Array.from(target).every(v => v === 0)).toBe(true)
  })

  it('works with a single source', () => {
    const target = new Uint8Array(4)
    orInto(target, Uint8Array.from([0, 1, 0, 1]))

    expect(Array.from(target)).toEqual([0, 1, 0, 1])
  })
})
