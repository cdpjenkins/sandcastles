import type { GridSnapshot } from './Grid.ts'
import type { WaterSimSnapshot } from '../sim/WaterSim.ts'
import type { WavesSnapshot } from '../sim/Waves.ts'
import type { TideSnapshot } from '../sim/Tide.ts'
import type { CameraSnapshot } from '../render/IsoCamera.ts'
import { ToolMode } from '../input/Tools.ts'

export const SNAPSHOT_VERSION = 1

const GRID_LAYERS = ['rock', 'sand', 'water', 'moisture', 'source', 'sediment'] as const
const FLOW_LAYERS = ['flowX', 'flowZ'] as const

export interface GameSnapshot {
  version: number
  width: number
  depth: number
  grid: GridSnapshot
  water: WaterSimSnapshot
  waves: WavesSnapshot
  tide: TideSnapshot
  bucket: { amount: number }
  camera: CameraSnapshot
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
}

const TOOL_MODES: readonly string[] = Object.values(ToolMode)

function isCellArray(value: unknown, cells: number): boolean {
  return value instanceof Float32Array && value.length === cells
}

function isScalar(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasCellArrays(group: unknown, names: readonly string[], cells: number): boolean {
  if (typeof group !== 'object' || group === null) return false
  const record = group as Record<string, unknown>
  return names.every((name) => isCellArray(record[name], cells))
}

function hasScalars(group: unknown, names: readonly string[]): boolean {
  if (typeof group !== 'object' || group === null) return false
  const record = group as Record<string, unknown>
  return names.every((name) => isScalar(record[name]))
}

export function isValidSnapshot(
  value: unknown,
  width: number,
  depth: number,
): value is GameSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>

  if (s['version'] !== SNAPSHOT_VERSION) return false
  if (s['width'] !== width || s['depth'] !== depth) return false

  const cells = width * depth
  if (!hasCellArrays(s['grid'], GRID_LAYERS, cells)) return false
  if (!hasCellArrays(s['water'], FLOW_LAYERS, cells)) return false

  if (!hasScalars(s['waves'], ['elapsed', 'timeUntilWave'])) return false
  if (!hasScalars(s['tide'], ['elapsed'])) return false
  if (!hasScalars(s['bucket'], ['amount'])) return false
  if (!hasScalars(s['camera'], ['zoom', 'panX', 'panZ'])) return false

  if (typeof s['toolMode'] !== 'string' || !TOOL_MODES.includes(s['toolMode'])) return false
  if (typeof s['paused'] !== 'boolean' || typeof s['lookEnabled'] !== 'boolean') return false

  return true
}
