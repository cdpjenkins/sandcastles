import { SNAPSHOT_VERSION } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import type { GridSnapshot } from './Grid.ts'
import type { WaterSimSnapshot } from '../sim/WaterSim.ts'
import type { WavesSnapshot } from '../sim/Waves.ts'
import type { TideSnapshot } from '../sim/Tide.ts'
import type { CameraSnapshot } from '../render/IsoCamera.ts'
import type { ToolMode } from '../input/Tools.ts'
import { encodeCells } from './base64Cells.ts'

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
