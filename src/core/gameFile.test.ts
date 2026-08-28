import { describe, it, expect } from 'vitest'
import {
  toGameFile, parseGameFile, exportFilename, exportStatus, FILE_ENCODING,
} from './GameFile.ts'
import { encodeCells, decodeCells } from './base64Cells.ts'
import { SNAPSHOT_VERSION, createSnapshot } from './GameSnapshot.ts'
import { ToolMode } from '../input/Tools.ts'
import { Grid } from './Grid.ts'
import { Bucket } from './Bucket.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import { IsoCamera } from '../render/IsoCamera.ts'

const SIZE = 4
const SAVED_AT = new Date('2026-08-21T17:40:00.000Z')

// Built from live components rather than a hand-written literal, so the file
// is always made from the shape the game actually snapshots.
function aSnapshot() {
  const grid = new Grid(SIZE, SIZE)
  grid.initBeach()
  grid.setSandHeight(1, 1, 7.5)
  const waterSim = new WaterSim(SIZE, SIZE)
  waterSim.setFlowX(2, 2, 0.75)
  const bucket = new Bucket(1000)
  bucket.fill(120)
  const tide = new Tide()
  tide.step(9)

  return createSnapshot({
    grid, waterSim, waves: new Waves(SIZE, SIZE), tide, bucket,
    camera: new IsoCamera(document.createElement('canvas')),
    toolMode: ToolMode.Stream, paused: true, lookEnabled: true,
  })
}

describe('toGameFile', () => {
  it('carries the snapshot version and tags how the layers are packed', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)

    expect(file.version).toBe(SNAPSHOT_VERSION)
    expect(file.encoding).toBe(FILE_ENCODING)
  })

  // Written for a human reading the file and for the download name. Nothing
  // reads it back, so it must never be required to load one.
  it('stamps when it was saved', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)

    expect(file.savedAt).toBe('2026-08-21T17:40:00.000Z')
  })

  it('carries the dimensions and the scalar state verbatim', () => {
    const snapshot = aSnapshot()

    const file = toGameFile(snapshot, SAVED_AT)

    expect(file.width).toBe(SIZE)
    expect(file.depth).toBe(SIZE)
    expect(file.waves).toEqual(snapshot.waves)
    expect(file.tide).toEqual(snapshot.tide)
    expect(file.bucket).toEqual(snapshot.bucket)
    expect(file.camera).toEqual(snapshot.camera)
    expect(file.toolMode).toBe(ToolMode.Stream)
    expect(file.paused).toBe(true)
    expect(file.lookEnabled).toBe(true)
  })

  it('encodes every grid layer so it decodes back to the same cells', () => {
    const snapshot = aSnapshot()

    const file = toGameFile(snapshot, SAVED_AT)

    expect(decodeLayers(file.grid)).toEqual(snapshot.grid)
  })

  it('encodes both flow layers so they decode back to the same cells', () => {
    const snapshot = aSnapshot()

    const file = toGameFile(snapshot, SAVED_AT)

    expect(decodeLayers(file.water)).toEqual(snapshot.water)
  })

  // The point of the format. A Float32Array left anywhere in here would
  // stringify to {"0":1,"1":2,...} and come back a plain object, which the
  // guard would reject on load - after the file had been written.
  it('holds nothing that JSON cannot carry', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)

    expect(JSON.parse(JSON.stringify(file))).toEqual(file)
  })
})

// Decoding the whole group at once asserts the layer names too: a file that
// dropped one would lose that part of the beach silently.
function decodeLayers(group: object) {
  return Object.fromEntries(
    Object.entries(group).map(([name, text]) => [name, decodeCells(text, SIZE * SIZE)]),
  )
}

describe('parseGameFile', () => {
  // The property the whole feature rests on: what Export writes, Import reads.
  // If these drift, every file is written and every one of them is refused.
  it('reads back a beach written by toGameFile', () => {
    const snapshot = aSnapshot()

    const text = JSON.stringify(toGameFile(snapshot, SAVED_AT))

    expect(parseGameFile(text, SIZE, SIZE)).toEqual(snapshot)
  })

  it('refuses text that is not JSON at all', () => {
    expect(parseGameFile('', SIZE, SIZE)).toBeNull()
    expect(parseGameFile('a beach', SIZE, SIZE)).toBeNull()
    expect(parseGameFile('{ "version": ', SIZE, SIZE)).toBeNull()
  })

  it('refuses JSON that is not an object', () => {
    expect(parseGameFile('42', SIZE, SIZE)).toBeNull()
    expect(parseGameFile('null', SIZE, SIZE)).toBeNull()
    expect(parseGameFile('"a beach"', SIZE, SIZE)).toBeNull()
  })

  it('refuses a file whose layers are packed some other way', () => {
    const text = aFileWith({ encoding: 'base64-f64le' })

    expect(parseGameFile(text, SIZE, SIZE)).toBeNull()
  })

  it('refuses a file written by a different schema version', () => {
    const text = aFileWith({ version: SNAPSHOT_VERSION + 1 })

    expect(parseGameFile(text, SIZE, SIZE)).toBeNull()
  })

  it('refuses a file with a layer missing', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)
    const { sand: _dropped, ...withoutSand } = file.grid

    expect(parseGameFile(JSON.stringify({ ...file, grid: withoutSand }), SIZE, SIZE)).toBeNull()
  })

  it('refuses a file whose layer does not hold a whole beach', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)
    const truncated = { ...file.grid, sand: encodeCells(new Float32Array(SIZE * SIZE - 1)) }

    expect(parseGameFile(JSON.stringify({ ...file, grid: truncated }), SIZE, SIZE)).toBeNull()
  })

  it('refuses a file taken on a grid of another size', () => {
    const text = JSON.stringify(toGameFile(aSnapshot(), SAVED_AT))

    expect(parseGameFile(text, SIZE + 1, SIZE)).toBeNull()
  })

  it('refuses a file with a whole group of state missing', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)
    const { grid: _noGrid, ...withoutGrid } = file
    const { water: _noWater, ...withoutWater } = file

    expect(parseGameFile(JSON.stringify(withoutGrid), SIZE, SIZE)).toBeNull()
    expect(parseGameFile(JSON.stringify(withoutWater), SIZE, SIZE)).toBeNull()
  })

  // savedAt is written for a human and never read back, so a file that
  // predates it - or one somebody edited by hand - still has to load.
  it('loads a file that carries no savedAt', () => {
    const file = toGameFile(aSnapshot(), SAVED_AT)
    const { savedAt: _unused, ...withoutStamp } = file

    expect(parseGameFile(JSON.stringify(withoutStamp), SIZE, SIZE)).toEqual(aSnapshot())
  })
})

describe('exportFilename', () => {
  it('names the file for the beach and the moment it was saved', () => {
    expect(exportFilename(SAVED_AT)).toBe('sandcastles-2026-08-21T17-40-00.json')
  })

  // The time is punctuated with dashes because a colon is illegal in a Windows
  // filename. Zero-padding comes from the ISO form and has to stay: a
  // hand-rolled format would sort wrongly in a directory listing.
  it('zero-pads a single-digit month, day and time', () => {
    const earlyInTheYear = new Date('2026-01-05T09:07:03.000Z')

    expect(exportFilename(earlyInTheYear)).toBe('sandcastles-2026-01-05T09-07-03.json')
  })
})

function aFileWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...toGameFile(aSnapshot(), SAVED_AT), ...overrides })
}


describe('exportStatus', () => {
  // The beach is still moving when the file is written, so the message says
  // which moment was captured rather than just that something was saved.
  //
  // Built as a local date rather than reusing SAVED_AT: that one is UTC, and
  // asserting its clock time here would pass or fail on the runner's timezone.
  it('names the file and the moment the beach was captured', () => {
    const savedAt = new Date(2026, 7, 21, 17, 40, 0)

    const status = exportStatus('sandcastles-2026-08-21T17-40-00.json', savedAt)

    expect(status).toContain('sandcastles-2026-08-21T17-40-00.json')
    expect(status).toMatch(/17:40:00|5:40:00/)
  })

  // Read at a glance next to a running sim, so the time is the local clock the
  // player is looking at, not the UTC the filename sorts by.
  it('shows the time on the local clock', () => {
    const noon = new Date(2026, 7, 21, 12, 5, 9)

    expect(exportStatus('beach.json', noon)).toMatch(/12:05:09/)
  })
})
