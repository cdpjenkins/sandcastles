import { SNAPSHOT_VERSION, GRID_LAYERS, FLOW_LAYERS, isValidSnapshot } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import type { GridSnapshot } from './Grid.ts'
import type { WaterSimSnapshot } from '../sim/WaterSim.ts'
import type { WavesSnapshot } from '../sim/Waves.ts'
import type { TideSnapshot } from '../sim/Tide.ts'
import type { CameraSnapshot } from '../render/IsoCamera.ts'
import type { ToolMode } from '../input/Tools.ts'
import { encodeCells, decodeCells } from './base64Cells.ts'

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
  bucket: { amount: number }
  camera: CameraSnapshot
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
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
  const candidate: unknown = {
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
  }

  return isValidSnapshot(candidate, width, depth) ? candidate : null
}

// Colons are illegal in a Windows filename. The ISO form is kept otherwise, so
// a directory of exports sorts by name into the order they were saved.
export function exportFilename(savedAt: Date): string {
  const stamp = savedAt.toISOString().slice(0, 19).replaceAll(':', '-')
  return `sandcastles-${stamp}.json`
}
