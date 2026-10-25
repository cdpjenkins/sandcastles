import { describe, it, expect } from 'vitest'
import {
  SNAPSHOT_VERSION, isValidSnapshot, loadSnapshot, createSnapshot, applySnapshot,
  newGameSnapshot, startNewGame, migrateSnapshot,
} from './GameSnapshot.ts'
import { POROSITY } from '../sim/Moisture.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import { ToolMode } from '../input/Tools.ts'
import { Grid } from './Grid.ts'
import { noiseSeed } from './BeachSeed.ts'
import { springSiteV1 } from './generators/v1/SpringSiteV1.ts'
import { Bucket } from './Bucket.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { layBeachV1, placeClassicSpringV1, V1_SPRING_RATE } from './generators/v1/BeachGeneratorV1.ts'

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
    bucket: { amount: 250, water: 0.5 },
    camera: { zoom: 80, panX: 128, panZ: 128 },
    toolMode: ToolMode.Spade,
    paused: false,
    lookEnabled: false,
    seed: null,
    generator: 1,
    seaStart: 3,
    seaLevel: 2,
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

  it('rejects a bucket that does not say how much water it holds', () => {
    expect(isValidSnapshot(aSnapshot({ bucket: { amount: 250 } }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a tool mode the game does not have', () => {
    expect(isValidSnapshot(aSnapshot({ toolMode: 'bulldozer' }), WIDTH, DEPTH)).toBe(false)
  })

  it('rejects a flag that is not a boolean', () => {
    expect(isValidSnapshot(aSnapshot({ paused: 'yes' }), WIDTH, DEPTH)).toBe(false)
  })

  // null is the classic beach; anything else is the text the beach grew from.
  it('accepts a classic beach and a seeded one', () => {
    expect(isValidSnapshot(aSnapshot({ seed: null }), WIDTH, DEPTH)).toBe(true)
    expect(isValidSnapshot(aSnapshot({ seed: 'salty-gull-42' }), WIDTH, DEPTH)).toBe(true)
  })

  it('rejects a save that does not say what beach it is', () => {
    expect(isValidSnapshot(aSnapshot({ seed: undefined }), WIDTH, DEPTH)).toBe(false)
    expect(isValidSnapshot(aSnapshot({ seed: 42 }), WIDTH, DEPTH)).toBe(false)
  })

  it('accepts a beach from a generator this game has', () => {
    expect(isValidSnapshot(aSnapshot({ generator: 1 }), WIDTH, DEPTH)).toBe(true)
  })

  // A save from a newer game names a generator this one cannot regrow.
  it('rejects a beach from a generator this game does not have', () => {
    for (const generator of [2, 0, '1', undefined]) {
      expect(isValidSnapshot(aSnapshot({ generator }), WIDTH, DEPTH)).toBe(false)
    }
  })

  // Classic is a v1 idea. No generator without a classic beach exists yet, so
  // the lookup is a stand-in for one.
  it('rejects a classic beach from a generator that has none', () => {
    const noClassic = (version: number) =>
      version === 7 ? { version: 7, hasClassic: false, generate: () => {} } : null

    expect(isValidSnapshot(aSnapshot({ generator: 7, seed: null }), WIDTH, DEPTH, noClassic)).toBe(false)
    expect(isValidSnapshot(aSnapshot({ generator: 7, seed: 'gull' }), WIDTH, DEPTH, noClassic)).toBe(true)
  })

  it('rejects a sea that starts off the grid or between rows', () => {
    for (const seaStart of [0, DEPTH, 1.5, undefined, '3']) {
      expect(isValidSnapshot(aSnapshot({ seaStart }), WIDTH, DEPTH)).toBe(false)
    }
  })

  it('rejects a sea level that is not a number', () => {
    for (const seaLevel of [NaN, Infinity, undefined, '2']) {
      expect(isValidSnapshot(aSnapshot({ seaLevel }), WIDTH, DEPTH)).toBe(false)
    }
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
    layBeachV1(grid)
    const waterSim = new WaterSim(64, 64)
    const waves = new Waves(64, 64)
    const tide = new Tide()
    const bucket = new Bucket(1000)
    const camera = new IsoCamera(document.createElement('canvas'))
    bucket.fill(120)
    tide.step(9)

    const snapshot = createSnapshot({
      grid, waterSim, waves, tide, bucket, camera,
      toolMode: ToolMode.Stream, paused: true, lookEnabled: false, seed: 'salty-gull-42', generator: 1,
    })

    expect(isValidSnapshot(snapshot, 64, 64)).toBe(true)
  })

  it('carries the live values, not defaults', () => {
    const grid = new Grid(64, 64)
    grid.setSea(40, 3.5)
    const bucket = new Bucket(1000)
    bucket.fill(120)
    const tide = new Tide()
    tide.step(9)

    const snapshot = createSnapshot({
      grid, waterSim: new WaterSim(64, 64), waves: new Waves(64, 64), tide, bucket,
      camera: new IsoCamera(document.createElement('canvas')),
      toolMode: ToolMode.Stream, paused: true, lookEnabled: false, seed: 'salty-gull-42', generator: 1,
    })

    expect(snapshot.bucket.amount).toBe(120)
    expect(snapshot.tide.elapsed).toBe(9)
    expect(snapshot.toolMode).toBe(ToolMode.Stream)
    expect(snapshot.paused).toBe(true)
    expect(snapshot.width).toBe(64)
    expect(snapshot.seed).toBe('salty-gull-42')
    expect(snapshot.generator).toBe(1)
    expect(snapshot.seaStart).toBe(40)
    expect(snapshot.seaLevel).toBe(3.5)
  })

  it('still loads back after a trip through storage', () => {
    const grid = new Grid(64, 64)
    layBeachV1(grid)

    const stored = structuredClone(createSnapshot({
      grid, waterSim: new WaterSim(64, 64), waves: new Waves(64, 64),
      tide: new Tide(), bucket: new Bucket(1000),
      camera: new IsoCamera(document.createElement('canvas')),
      toolMode: ToolMode.Spade, paused: false, lookEnabled: false, seed: null, generator: 1,
    }))

    expect(isValidSnapshot(stored, 64, 64)).toBe(true)
  })
})

const SIZE = 64

function freshComponents() {
  return {
    grid: new Grid(SIZE, SIZE),
    waterSim: new WaterSim(SIZE, SIZE),
    waves: new Waves(SIZE, SIZE),
    tide: new Tide(),
    bucket: new Bucket(1000),
    camera: new IsoCamera(document.createElement('canvas')),
  }
}

function aLiveBeach() {
  const components = freshComponents()
  layBeachV1(components.grid)
  components.grid.setSandHeight(3, 4, 7.5)
  components.grid.setWaterHeight(5, 6, 2.25)
  components.waterSim.setFlowX(2, 2, 0.75)
  components.waterSim.setFlowZ(1, 1, -0.5)
  components.waves.step(components.grid, 0.5, 2)
  components.tide.step(9)
  components.bucket.fill(120, 0.005)
  components.camera.restore({ zoom: 55, panX: 10, panZ: 20 })
  components.grid.setSea(40, 3.5)
  return components
}

const UI = { toolMode: ToolMode.Stream, paused: true, lookEnabled: true, seed: 'salty-gull-42', generator: 1 }

describe('applySnapshot', () => {
  // The other half of the property createSnapshot's tests protect. Game cannot
  // be built under jsdom, so this round trip through real components is what
  // says boot and import put the beach back the same way.
  it('puts a fresh game into the state the snapshot describes', () => {
    const snapshot = createSnapshot({ ...aLiveBeach(), ...UI })
    const restored = freshComponents()

    applySnapshot(restored, snapshot)

    expect(createSnapshot({ ...restored, ...UI })).toEqual(snapshot)
  })

  // The bucket is the one target that is not a plain restore: fill() adds, and
  // an import lands in a game whose bucket may already hold sand.
  // The sea is the beach's own, chosen by the generator that laid it out.
  it('puts the sea back the beach was saved with', () => {
    const snapshot = createSnapshot({ ...aLiveBeach(), ...UI })
    const restored = freshComponents()

    applySnapshot(restored, snapshot)

    expect(restored.grid.seaStart).toBe(40)
    expect(restored.grid.seaLevel).toBe(3.5)
  })

  it('sets the bucket rather than adding to what it holds', () => {
    const snapshot = createSnapshot({ ...aLiveBeach(), ...UI })
    const restored = freshComponents()
    restored.bucket.fill(300)

    applySnapshot(restored, snapshot)

    expect(restored.bucket.amount).toBe(120)
    expect(restored.bucket.water).toBeCloseTo(0.6)
  })
})

// Version 1 stored moisture as a 0-1 fraction; version 2 stores the water
// itself. Same layer, same shape, so nothing structural tells them apart: a v1
// save read as v2 would load cleanly and be wrong, and one refused would cost
// the player their beach.
describe('migrateSnapshot', () => {
  const aVersion1 = () => {
    const snapshot = aSnapshot({ version: 1, bucket: { amount: 250 } }) as unknown as {
      grid: { sand: Float32Array; moisture: Float32Array }
    }
    snapshot.grid.sand[0] = 3
    snapshot.grid.moisture[0] = 0.5
    snapshot.grid.sand[1] = 0
    snapshot.grid.moisture[1] = 1
    return snapshot
  }

  it('turns a v1 save into one this version loads', () => {
    expect(isValidSnapshot(migrateSnapshot(aVersion1()), WIDTH, DEPTH)).toBe(true)
  })

  it('keeps each cell as wet as it looked, now as water held', () => {
    const migrated = migrateSnapshot(aVersion1()) as GameSnapshot

    expect(migrated.grid.moisture[0]).toBeCloseTo(0.5 * POROSITY * 3, 6)
  })

  it('wet rock holds no water: it read wet from the water above it', () => {
    const migrated = migrateSnapshot(aVersion1()) as GameSnapshot

    expect(migrated.grid.moisture[1]).toBe(0)
  })

  it('gives the old bucket dry sand', () => {
    const migrated = migrateSnapshot(aVersion1()) as GameSnapshot

    expect(migrated.bucket).toEqual({ amount: 250, water: 0 })
  })

  it('leaves the save it was handed alone', () => {
    const v1 = aVersion1()

    migrateSnapshot(v1)

    expect(v1.grid.moisture[0]).toBe(0.5)
  })

  // Every beach before seeds existed was the classic one, so a v2 save is
  // classic as a matter of fact, not a guess.
  it('marks a v2 save as the classic beach', () => {
    const v2 = aSnapshot({ version: 2, seed: undefined })

    const migrated = migrateSnapshot(v2) as GameSnapshot

    expect(migrated.version).toBe(SNAPSHOT_VERSION)
    expect(migrated.seed).toBeNull()
    expect(isValidSnapshot(migrated, WIDTH, DEPTH)).toBe(true)
  })

  it('leaves the v2 save it was handed alone', () => {
    const v2 = aSnapshot({ version: 2, seed: undefined })

    migrateSnapshot(v2)

    expect(v2.version).toBe(2)
    expect(v2.seed).toBeUndefined()
  })

  it('takes a v1 save all the way to classic', () => {
    expect((migrateSnapshot(aVersion1()) as GameSnapshot).seed).toBeNull()
  })

  // Every beach before generators were versioned was grown by what became v1,
  // so a v3 save is v1 as a matter of fact, with v1's sea for its depth.
  it('marks a v3 save as grown by v1, with v1\'s sea', () => {
    const v3 = aSnapshot({ version: 3, generator: undefined, seaStart: undefined, seaLevel: undefined })

    const migrated = migrateSnapshot(v3) as GameSnapshot

    expect(migrated.version).toBe(SNAPSHOT_VERSION)
    expect(migrated.generator).toBe(1)
    expect(migrated.seaStart).toBe(Math.floor(DEPTH * 0.78))
    expect(migrated.seaLevel).toBe(2)
    expect(isValidSnapshot(migrated, WIDTH, DEPTH)).toBe(true)
  })

  it('leaves the v3 save it was handed alone', () => {
    const v3 = aSnapshot({ version: 3, generator: undefined, seaStart: undefined, seaLevel: undefined })

    migrateSnapshot(v3)

    expect(v3.version).toBe(3)
    expect(v3.generator).toBeUndefined()
  })

  it('takes a v1 save all the way to v1\'s generator and sea', () => {
    const migrated = migrateSnapshot(aVersion1()) as GameSnapshot

    expect(migrated.generator).toBe(1)
    expect(migrated.seaStart).toBe(Math.floor(DEPTH * 0.78))
  })

  it('passes a current save through untouched', () => {
    const current = aSnapshot()

    expect(migrateSnapshot(current)).toBe(current)
  })

  it('passes garbage through for the guard to refuse', () => {
    expect(migrateSnapshot('a beach')).toBe('a beach')
    expect(isValidSnapshot(migrateSnapshot({ version: 1 }), WIDTH, DEPTH)).toBe(false)
  })

  it('is what loadSnapshot does to a v1 autosave', async () => {
    const loaded = await loadSnapshot(aStoreHolding(aVersion1()), WIDTH, DEPTH)

    expect(loaded).not.toBeNull()
    expect(loaded!.grid.moisture[0]).toBeCloseTo(0.5 * POROSITY * 3, 6)
  })
})


describe('starting a new game', () => {
  const played = () => {
    const components = aLiveBeach()
    startNewGame(components, SIZE, SIZE, { generator: 1, seed: null })
    return components
  }

  it('is a loadable beach', () => {
    expect(isValidSnapshot(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: null }), SIZE, SIZE)).toBe(true)
  })

  it('lays out the same beach a first-ever boot gets', () => {
    const booted = freshComponents()
    layBeachV1(booted.grid)
    placeClassicSpringV1(booted.grid, 1.0)

    expect(played().grid.snapshot()).toEqual(booted.grid.snapshot())
  })

  // The beach the player dug is gone, not merged into the new one: every
  // layer is laid out afresh, so no sand, water, damp patch or dug channel
  // survives from the game before.
  it('leaves nothing of the beach the player was digging', () => {
    const beach = aLiveBeach()
    beach.grid.setMoisture(8, 9, 0.9)
    beach.grid.setSediment(8, 9, 0.4)
    beach.grid.setSourceRate(20, 21, 1.0)
    const dug = beach.grid.snapshot()

    startNewGame(beach, SIZE, SIZE, { generator: 1, seed: null })

    expect(beach.grid.snapshot()).not.toEqual(dug)
    expect(beach.grid.getMoisture(8, 9)).toBe(0)
    expect(beach.grid.getSediment(8, 9)).toBe(0)
    expect(beach.grid.getSourceRate(20, 21)).toBe(0)
  })

  it('stills the water the old beach was carrying', () => {
    const started = played()

    expect(started.waterSim.getFlowX(2, 2)).toBe(0)
    expect(started.waterSim.getFlowZ(1, 1)).toBe(0)
  })

  it('starts the swell and the tide from the beginning', () => {
    const started = played()

    expect(started.waves.snapshot().elapsed).toBe(0)
    expect(started.tide.snapshot().elapsed).toBe(0)
  })

  it('hands the player an empty bucket', () => {
    expect(played().bucket.amount).toBe(0)
  })

  // The camera is where the player left it on purpose: a new beach occupies
  // the same world, and yanking the view back would read as a lost position
  // rather than a new game.
  it('leaves the camera where the player had it', () => {
    const started = played()

    expect(started.camera.snapshot()).toEqual({ zoom: 55, panX: 10, panZ: 20 })
  })

  // Every scene in CLAUDE.md was tuned with the spring here, and its stream
  // reaches the sea at 185s. A seeded beach will place its own spring; the
  // classic one must not move. A literal cell rather than a comparison with
  // placeClassicSpringV1, which would move with it.
  it('puts the classic spring at top-centre, and nowhere else', () => {
    const { grid } = newGameSnapshot(256, 256, { generator: 1, seed: null })
    const sources: { x: number; z: number; rate: number }[] = []
    grid.source.forEach((rate, i) => {
      if (rate !== 0) sources.push({ x: i % 256, z: Math.floor(i / 256), rate })
    })

    expect(sources).toEqual([{ x: 128, z: 1, rate: 1 }])
  })

  // A save from a newer game may name a generator this one does not have;
  // nothing can lay that beach out, and pretending would be worse.
  it('records the generator and the sea it laid the beach out with', () => {
    const snapshot = newGameSnapshot(SIZE, SIZE, { generator: 1, seed: 'gull' })

    expect(snapshot.generator).toBe(1)
    expect(snapshot.seaStart).toBe(Math.floor(SIZE * 0.78))
    expect(snapshot.seaLevel).toBe(2)
  })

  it('refuses a generator this game does not have', () => {
    expect(() => newGameSnapshot(SIZE, SIZE, { generator: 99, seed: 'gull' })).toThrow()
  })

  it('is the classic beach when given no seed', () => {
    expect(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: null }).seed).toBeNull()
  })

  it('grows the beach from the seed it is given, and records it', () => {
    const grown = new Grid(SIZE, SIZE)
    layBeachV1(grown, noiseSeed('salty-gull-42'))
    const site = springSiteV1(grown, 'salty-gull-42')
    grown.setSourceRate(site.x, site.z, V1_SPRING_RATE)

    const snapshot = newGameSnapshot(SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' })

    expect(snapshot.grid).toEqual(grown.snapshot())
    expect(snapshot.seed).toBe('salty-gull-42')
  })

  // The classic spring is top-centre whatever the land around it does; a
  // seeded beach puts its own where its water will reach the sea.
  it('gives a seeded beach one spring, where springSiteV1 puts it', () => {
    const grown = new Grid(256, 256)
    layBeachV1(grown, noiseSeed('salty-gull-42'))
    const site = springSiteV1(grown, 'salty-gull-42')

    const { grid } = newGameSnapshot(256, 256, { generator: 1, seed: 'salty-gull-42' })
    const sources: { x: number; z: number; rate: number }[] = []
    grid.source.forEach((rate, i) => {
      if (rate !== 0) sources.push({ x: i % 256, z: Math.floor(i / 256), rate })
    })

    expect(sources).toEqual([{ ...site, rate: V1_SPRING_RATE }])
  })

  // noiseSeed trims, so the land ignores spaces round a seed; the spring must
  // too, or the same land would grow a different spring.
  it('grows the same spring for a seed with spaces round it', () => {
    expect(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: '  salty-gull-42 ' }).grid.source)
      .toEqual(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' }).grid.source)
  })

  it('lays a different beach for a seed than for classic', () => {
    expect(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' }).grid.sand)
      .not.toEqual(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: null }).grid.sand)
  })

  it('starts unpaused, with the spade in hand and Look off', () => {
    const snapshot = newGameSnapshot(SIZE, SIZE, { generator: 1, seed: null })

    expect(snapshot.toolMode).toBe(ToolMode.Spade)
    expect(snapshot.paused).toBe(false)
    expect(snapshot.lookEnabled).toBe(false)
  })
})
