import { SNAPSHOT_VERSION, GRID_LAYERS, FLOW_LAYERS, isValidSnapshot, migrateSnapshot } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import type { GridSnapshot } from './Grid.ts'
import type { WaterSimSnapshot } from '../sim/WaterSim.ts'
import type { WavesSnapshot } from '../sim/Waves.ts'
import type { TideSnapshot } from '../sim/Tide.ts'
import type { CameraSnapshot } from '../render/IsoCamera.ts'
import type { ToolMode } from '../input/Tools.ts'
import { encodeCells, decodeCells } from './base64Cells.ts'
import type { BeachSeed } from './BeachSeed.ts'
import type { BeachSpec } from './generators/BeachGenerator.ts'

export const FILE_ENCODING = 'base64-f32le'

// Derived from the sim's own shapes, so a layer added there is a compile error
// here rather than a layer quietly missing from every exported file.
export type GridLayerFile = { [K in keyof GridSnapshot]: string }
export type FlowLayerFile = { [K in keyof WaterSimSnapshot]: string }

export interface GameFile {
  version: number
  encoding: string
  savedAt: string
  width: number
  depth: number
  grid: GridLayerFile
  water: FlowLayerFile
  waves: WavesSnapshot
  tide: TideSnapshot
  bucket: GameSnapshot['bucket']
  camera: CameraSnapshot
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
  seed: BeachSeed
  generator: number
  seaStart: number
  seaLevel: number
}

export function toGameFile(snapshot: GameSnapshot, savedAt: Date): GameFile {
  return {
    version: SNAPSHOT_VERSION,
    encoding: FILE_ENCODING,
    savedAt: savedAt.toISOString(),
    width: snapshot.width,
    depth: snapshot.depth,
    grid: {
      rock: encodeCells(snapshot.grid.rock),
      sand: encodeCells(snapshot.grid.sand),
      water: encodeCells(snapshot.grid.water),
      moisture: encodeCells(snapshot.grid.moisture),
      source: encodeCells(snapshot.grid.source),
      sediment: encodeCells(snapshot.grid.sediment),
    },
    water: {
      flowX: encodeCells(snapshot.water.flowX),
      flowZ: encodeCells(snapshot.water.flowZ),
    },
    waves: snapshot.waves,
    tide: snapshot.tide,
    bucket: snapshot.bucket,
    camera: snapshot.camera,
    toolMode: snapshot.toolMode,
    paused: snapshot.paused,
    lookEnabled: snapshot.lookEnabled,
    seed: snapshot.seed,
    generator: snapshot.generator,
    seaStart: snapshot.seaStart,
    seaLevel: snapshot.seaLevel,
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function decodeGroup(
  group: unknown,
  names: readonly string[],
  cells: number,
): Record<string, Float32Array> | null {
  if (typeof group !== 'object' || group === null) return null
  const record = group as Record<string, unknown>
  const decoded: Record<string, Float32Array> = {}
  for (const name of names) {
    const text = record[name]
    if (typeof text !== 'string') return null
    const layer = decodeCells(text, cells)
    if (layer === null) return null
    decoded[name] = layer
  }
  return decoded
}

// A file is hostile input. Everything unreadable, stale or corrupt comes back
// as null, the same posture loadSnapshot takes towards storage. The decoded
// candidate is then held to isValidSnapshot - the guard that already decides
// what a loadable beach is - rather than to a second set of rules here.
export function parseGameFile(
  text: string,
  width: number,
  depth: number,
): GameSnapshot | null {
  const parsed = parseJson(text)
  if (typeof parsed !== 'object' || parsed === null) return null
  const file = parsed as Record<string, unknown>

  if (file['encoding'] !== FILE_ENCODING) return null

  const cells = width * depth
  const candidate: unknown = migrateSnapshot({
    version: file['version'],
    width: file['width'],
    depth: file['depth'],
    grid: decodeGroup(file['grid'], GRID_LAYERS, cells),
    water: decodeGroup(file['water'], FLOW_LAYERS, cells),
    waves: file['waves'],
    tide: file['tide'],
    bucket: file['bucket'],
    camera: file['camera'],
    toolMode: file['toolMode'],
    paused: file['paused'],
    lookEnabled: file['lookEnabled'],
    seed: file['seed'],
    generator: file['generator'],
    seaStart: file['seaStart'],
    seaLevel: file['seaLevel'],
  })

  return isValidSnapshot(candidate, width, depth) ? candidate : null
}

// What the player is told after a download. The beach is still moving when the
// file is written - export is offered on a running game - so this names the
// moment that was captured rather than just reporting that something saved.
// The local clock, not the filename's UTC: this is read at a glance against a
// running sim.
export function exportStatus(filename: string, savedAt: Date): string {
  return `Saved ${filename} (beach at ${savedAt.toLocaleTimeString()})`
}

const FILENAME_SEED_LENGTH = 40

// A label for the beach, not a way back to it: import reads the seed from the
// file, never from its name, so this is free to throw information away. A typed
// seed is any text at all, and only these characters are certain to survive
// every filesystem and download prompt.
export function seedForFilename(seed: BeachSeed): string {
  if (seed === null) return 'classic'
  const dashed = seed.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-')
  return dashed.replace(/^-+|-+$/g, '').slice(0, FILENAME_SEED_LENGTH).replace(/-+$/, '')
}

// The generator comes first, then the beach, so a directory of exports sorts
// by generator, then beach, then into the order they were saved. "gen", never
// a bare "v": the file also carries the save format's version, which changes
// for unrelated reasons. Colons are illegal in a Windows filename; the ISO
// form is kept otherwise, zero-padding and all, for that sort.
export function exportFilename(savedAt: Date, beach: BeachSpec): string {
  const stamp = savedAt.toISOString().slice(0, 19).replaceAll(':', '-')
  const gen = `gen${beach.generator}`
  const seed = seedForFilename(beach.seed)
  return seed === '' ? `sandcastles-${gen}-${stamp}.json` : `sandcastles-${gen}-${seed}-${stamp}.json`
}
