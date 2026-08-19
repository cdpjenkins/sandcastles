import { describe, it, expect } from 'vitest'
import { SNAPSHOT_VERSION, isValidSnapshot, loadSnapshot, createSnapshot } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import { ToolMode } from '../input/Tools.ts'
import { Grid } from './Grid.ts'
import { Bucket } from './Bucket.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import { IsoCamera } from '../render/IsoCamera.ts'

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

describe('a snapshot in storage', () => {
  // IndexedDB serialises with the structured clone algorithm, and jsdom has
  // no indexedDB at all, so cloning is the closest thing to a proof that what
  // we store is what we get back. If this breaks, the save format has grown a
  // field that cannot cross the storage boundary.
  it('survives the round trip that IndexedDB will put it through', () => {
    const original = aSnapshot()
    original.grid.sand[5] = 12.5
    original.grid.rock[9] = -3.25
    original.water.flowX[2] = 0.75

    const stored = structuredClone(original)

    // Compared as plain arrays: under jsdom the clone lands in Node's realm,
    // so toEqual on the Float32Arrays themselves fails on the constructor
    // while reporting "no visual difference". The numbers are what matter.
    expect(isValidSnapshot(stored, WIDTH, DEPTH)).toBe(true)
    expect(Array.from(stored.grid.sand)).toEqual(Array.from(original.grid.sand))
    expect(Array.from(stored.grid.rock)).toEqual(Array.from(original.grid.rock))
    expect(Array.from(stored.water.flowX)).toEqual(Array.from(original.water.flowX))
    expect(stored.tide.elapsed).toBe(original.tide.elapsed)
    expect(stored.toolMode).toBe(original.toolMode)
  })

  it('comes back as real cell data, not a plain object', () => {
    // A format that degraded Float32Array to {0:..,1:..} would still look
    // right field by field, and isValidSnapshot is what would catch it.
    const stored = structuredClone(aSnapshot())

    expect(Object.prototype.toString.call(stored.grid.sand)).toBe('[object Float32Array]')
  })
})

function aStoreHolding(value: unknown) {
  return {
    load: () => Promise.resolve(value),
    save: () => Promise.resolve(),
  }
}

describe('loadSnapshot', () => {
  it('hands back a save that is good for this grid', async () => {
    const snapshot = aSnapshot()

    const loaded = await loadSnapshot(aStoreHolding(snapshot), WIDTH, DEPTH)

    expect(loaded).toBe(snapshot)
  })

  it('starts a fresh beach when there is no save yet', async () => {
    expect(await loadSnapshot(aStoreHolding(null), WIDTH, DEPTH)).toBeNull()
  })

  it('starts a fresh beach rather than loading a save it cannot trust', async () => {
    expect(await loadSnapshot(aStoreHolding({ version: 99 }), WIDTH, DEPTH)).toBeNull()
    expect(await loadSnapshot(aStoreHolding('garbage'), WIDTH, DEPTH)).toBeNull()
    expect(await loadSnapshot(aStoreHolding(aSnapshot()), WIDTH + 1, DEPTH)).toBeNull()
  })

  it('starts a fresh beach when storage itself fails', async () => {
    // Private browsing, a blocked database, a corrupt object store: opening
    // IndexedDB can reject outright, and that must not stop the game booting.
    const failing = {
      load: () => Promise.reject(new Error('database blocked')),
      save: () => Promise.resolve(),
    }

    expect(await loadSnapshot(failing, WIDTH, DEPTH)).toBeNull()
  })
})

describe('createSnapshot', () => {
  // The one property that makes the whole feature work: what the game writes
  // has to be something the guard will accept back. If these ever drift, every
  // save is written and every load rejects it, and autosave silently does
  // nothing at all.
  it('builds a snapshot of the live game that loads back', () => {
    const grid = new Grid(64, 64)
    grid.initBeach()
    const waterSim = new WaterSim(64, 64)
    const waves = new Waves(64, 64)
    const tide = new Tide()
    const bucket = new Bucket(1000)
    const camera = new IsoCamera(document.createElement('canvas'))
    bucket.fill(120)
    tide.step(9)

    const snapshot = createSnapshot({
      grid, waterSim, waves, tide, bucket, camera,
      toolMode: ToolMode.Stream, paused: true, lookEnabled: false,
    })

    expect(isValidSnapshot(snapshot, 64, 64)).toBe(true)
  })

  it('carries the live values, not defaults', () => {
    const grid = new Grid(64, 64)
    const bucket = new Bucket(1000)
    bucket.fill(120)
    const tide = new Tide()
    tide.step(9)

    const snapshot = createSnapshot({
      grid, waterSim: new WaterSim(64, 64), waves: new Waves(64, 64), tide, bucket,
      camera: new IsoCamera(document.createElement('canvas')),
      toolMode: ToolMode.Stream, paused: true, lookEnabled: false,
    })

    expect(snapshot.bucket.amount).toBe(120)
    expect(snapshot.tide.elapsed).toBe(9)
    expect(snapshot.toolMode).toBe(ToolMode.Stream)
    expect(snapshot.paused).toBe(true)
    expect(snapshot.width).toBe(64)
  })

  it('still loads back after a trip through storage', () => {
    const grid = new Grid(64, 64)
    grid.initBeach()

    const stored = structuredClone(createSnapshot({
      grid, waterSim: new WaterSim(64, 64), waves: new Waves(64, 64),
      tide: new Tide(), bucket: new Bucket(1000),
      camera: new IsoCamera(document.createElement('canvas')),
      toolMode: ToolMode.Spade, paused: false, lookEnabled: false,
    }))

    expect(isValidSnapshot(stored, 64, 64)).toBe(true)
  })
})
