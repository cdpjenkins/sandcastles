import { describe, it, expect } from 'vitest'
import { SNAPSHOT_VERSION, isValidSnapshot } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import { ToolMode } from '../input/Tools.ts'

const WIDTH = 4
const DEPTH = 4

function aSnapshot(overrides: Record<string, unknown> = {}): GameSnapshot {
  const cells = () => new Float32Array(WIDTH * DEPTH)
  return {
    version: SNAPSHOT_VERSION,
    width: WIDTH,
    depth: DEPTH,
    grid: {
      rock: cells(), sand: cells(), water: cells(),
      moisture: cells(), source: cells(), sediment: cells(),
    },
    water: { flowX: cells(), flowZ: cells() },
    waves: { elapsed: 1.5, timeUntilWave: 0.5 },
    tide: { elapsed: 12 },
    bucket: { amount: 250 },
    camera: { zoom: 80, panX: 128, panZ: 128 },
    toolMode: ToolMode.Spade,
    paused: false,
    lookEnabled: false,
    ...overrides,
  } as GameSnapshot
}

describe('isValidSnapshot', () => {
  it('accepts a well-formed snapshot for the current grid', () => {
    expect(isValidSnapshot(aSnapshot(), WIDTH, DEPTH)).toBe(true)
  })

  it('rejects a missing save', () => {
    expect(isValidSnapshot(null, WIDTH, DEPTH)).toBe(false)
    expect(isValidSnapshot(undefined, WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a value that is not an object', () => {
    expect(isValidSnapshot('a beach', WIDTH, DEPTH)).toBe(false)
    expect(isValidSnapshot(42, WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a save written by a different schema version', () => {
    expect(isValidSnapshot(aSnapshot({ version: SNAPSHOT_VERSION + 1 }), WIDTH, DEPTH)).toBe(false)
    expect(isValidSnapshot(aSnapshot({ version: SNAPSHOT_VERSION - 1 }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a save taken on a grid of different dimensions', () => {
    expect(isValidSnapshot(aSnapshot(), WIDTH + 1, DEPTH)).toBe(false)
    expect(isValidSnapshot(aSnapshot(), WIDTH, DEPTH + 1)).toBe(false)
  })

  it('rejects a save missing a whole group of state', () => {
    expect(isValidSnapshot(aSnapshot({ tide: undefined }), WIDTH, DEPTH)).toBe(false)
    expect(isValidSnapshot(aSnapshot({ water: undefined }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects an array of the wrong length for the grid', () => {
    const grid = aSnapshot().grid
    const truncated = { ...grid, sand: new Float32Array(WIDTH * DEPTH - 1) }

    expect(isValidSnapshot(aSnapshot({ grid: truncated }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a plain array where cell data is required', () => {
    const grid = aSnapshot().grid
    const plain = { ...grid, sand: new Array(WIDTH * DEPTH).fill(0) }

    expect(isValidSnapshot(aSnapshot({ grid: plain }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a scalar that is not a finite number', () => {
    expect(isValidSnapshot(aSnapshot({ tide: { elapsed: NaN } }), WIDTH, DEPTH)).toBe(false)
    expect(isValidSnapshot(aSnapshot({ bucket: { amount: Infinity } }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a tool mode the game does not have', () => {
    expect(isValidSnapshot(aSnapshot({ toolMode: 'bulldozer' }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a flag that is not a boolean', () => {
    expect(isValidSnapshot(aSnapshot({ paused: 'yes' }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a save whose dimensions are transposed but cell count agrees', () => {
    // 4x4 and 2x8 both hold 16 cells, so every array is the expected length
    // and only the dimensions give the mismatch away. Restoring it would
    // reinterpret the rows and scramble the beach.
    expect(isValidSnapshot(aSnapshot(), 2, 8)).toBe(false)
  })
})
