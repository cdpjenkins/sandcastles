import { describe, it, expect } from 'vitest'
import { toGameFile, FILE_ENCODING } from './GameFile.ts'
import { decodeCells } from './base64Cells.ts'
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
