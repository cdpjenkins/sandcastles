import type { GridSnapshot } from './Grid.ts'
import type { WaterSimSnapshot } from '../sim/WaterSim.ts'
import type { WavesSnapshot } from '../sim/Waves.ts'
import type { TideSnapshot } from '../sim/Tide.ts'
import type { CameraSnapshot } from '../render/IsoCamera.ts'
import { ToolMode } from '../input/Tools.ts'
import type { SnapshotStore } from './SnapshotStore.ts'

export const SNAPSHOT_VERSION = 1

export const GRID_LAYERS = ['rock', 'sand', 'water', 'moisture', 'source', 'sediment'] as const
export const FLOW_LAYERS = ['flowX', 'flowZ'] as const

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

// Brand-check rather than `instanceof`: a value that has crossed a realm
// boundary - which is exactly what deserialising from storage is - fails
// `instanceof` against this realm's Float32Array while being a perfectly good
// Float32Array. The tag is realm-independent and still rejects plain arrays
// and other typed arrays.
function isCellArray(value: unknown, cells: number): boolean {
  if (Object.prototype.toString.call(value) !== '[object Float32Array]') return false
  return (value as Float32Array).length === cells
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

// Storage is treated as hostile and never allowed to stop the game booting:
// anything unreadable, stale or corrupt comes back as null, which the caller
// reads as "start a fresh beach".
export async function loadSnapshot(
  store: SnapshotStore,
  width: number,
  depth: number,
): Promise<GameSnapshot | null> {
  try {
    const stored = await store.load()
    return isValidSnapshot(stored, width, depth) ? stored : null
  } catch {
    return null
  }
}

// Structurally typed so Grid, WaterSim and friends satisfy it as they are.
// Game builds its snapshot through here rather than assembling the literal
// itself, so the shape the tests check is the shape the game writes.
export interface SnapshotSources {
  grid: { width: number; depth: number; snapshot(): GridSnapshot }
  waterSim: { snapshot(): WaterSimSnapshot }
  waves: { snapshot(): WavesSnapshot }
  tide: { snapshot(): TideSnapshot }
  bucket: { amount: number }
  camera: { snapshot(): CameraSnapshot }
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
}

export function createSnapshot(sources: SnapshotSources): GameSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    width: sources.grid.width,
    depth: sources.grid.depth,
    grid: sources.grid.snapshot(),
    water: sources.waterSim.snapshot(),
    waves: sources.waves.snapshot(),
    tide: sources.tide.snapshot(),
    bucket: { amount: sources.bucket.amount },
    camera: sources.camera.snapshot(),
    toolMode: sources.toolMode,
    paused: sources.paused,
    lookEnabled: sources.lookEnabled,
  }
}

export interface SnapshotTargets {
  grid: { restore(snapshot: GridSnapshot): void }
  waterSim: { restore(snapshot: WaterSimSnapshot): void }
  waves: { restore(snapshot: WavesSnapshot): void }
  tide: { restore(snapshot: TideSnapshot): void }
  bucket: { setAmount(amount: number): void }
  camera: { restore(snapshot: CameraSnapshot): void }
}

export function applySnapshot(targets: SnapshotTargets, snapshot: GameSnapshot): void {
  targets.grid.restore(snapshot.grid)
  targets.waterSim.restore(snapshot.water)
  targets.waves.restore(snapshot.waves)
  targets.tide.restore(snapshot.tide)
  targets.bucket.setAmount(snapshot.bucket.amount)
  targets.camera.restore(snapshot.camera)
}
