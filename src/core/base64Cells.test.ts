import { describe, it, expect } from 'vitest'
import { encodeCells, decodeCells } from './base64Cells.ts'

describe('base64 cell layers', () => {
  it('round-trips an empty layer', () => {
    const empty = new Float32Array(0)

    const decoded = decodeCells(encodeCells(empty), 0)

    expect(decoded).toEqual(empty)
  })

  it('encodes a cell as its little-endian float32 bytes', () => {
    const one = new Float32Array([1])

    const encoded = encodeCells(one)

    expect(encoded).toBe('AACAPw==')
  })

  // The magnitudes are the ones the beach actually holds: a sediment column
  // sits around 1e-6 and the drying film around 1e-4, and both must survive.
  it('round-trips negative and very small values bit-exactly', () => {
    const layer = new Float32Array([1, -2.5, 1e-6, 0, 1e-4, -1e-6])

    const decoded = decodeCells(encodeCells(layer), layer.length)

    expect(decoded).toEqual(layer)
  })

  it('rejects a payload that does not hold the expected number of cells', () => {
    const layer = new Float32Array([1, 2, 3])

    const decoded = decodeCells(encodeCells(layer), 4)

    expect(decoded).toBeNull()
  })

  // A file is hostile input: atob throws on a character outside the alphabet,
  // and that must not reach the game loop.
  it('rejects a string that is not base64', () => {
    const decoded = decodeCells('not base64 at all!', 4)

    expect(decoded).toBeNull()
  })

  // A real 256x256 layer is 262,144 bytes, and spreading that many arguments
  // into String.fromCharCode overflows the call stack.
  it('round-trips a full-size layer', () => {
    const cells = 256 * 256
    const layer = new Float32Array(cells)
    for (let i = 0; i < cells; i++) layer[i] = Math.sin(i) * 20

    const decoded = decodeCells(encodeCells(layer), cells)

    expect(decoded).toEqual(layer)
  })

  // The signature promises a Float32Array, and a view over a larger buffer is
  // one. Reading through to the whole buffer would corrupt it silently.
  it('encodes only the cells a view covers', () => {
    const middle = new Float32Array([1, -2.5, 1e-6, 0]).subarray(1, 3)

    const decoded = decodeCells(encodeCells(middle), 2)

    expect(decoded).toEqual(new Float32Array([-2.5, 1e-6]))
  })
})
