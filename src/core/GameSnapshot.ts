import { Grid, STREAM_RATE } from './Grid.ts'
import type { GridSnapshot } from './Grid.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import type { WaterSimSnapshot } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import type { WavesSnapshot } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import type { TideSnapshot } from '../sim/Tide.ts'
import { DEFAULT_CAMERA } from '../render/IsoCamera.ts'
import type { CameraSnapshot } from '../render/IsoCamera.ts'
import { ToolMode } from '../input/Tools.ts'
import { POROSITY } from '../sim/Moisture.ts'
import type { SnapshotStore } from './SnapshotStore.ts'
import type { BeachSeed } from './BeachSeed.ts'

// 2: moisture holds water rather than a 0-1 fraction, and the bucket carries
// water. 3: the seed the beach grew from. migrateSnapshot reads a 1 or a 2.
export const SNAPSHOT_VERSION = 3

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
  bucket: { amount: number; water: number }
  camera: CameraSnapshot
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
  seed: BeachSeed
}

const TOOL_MODES: readonly string[] = Object.values(ToolMode)

// Brand-check rather than `instanceof`: a value that has crossed a realm
// boundary - which is exactly what deserialising from storage is - fails
// `instanceof` against this realm's Float32Array while being a perfectly good
// Float32Array. The tag is realm-independent and still rejects plain arrays
// and other typed arrays.
function isFloat32Array(value: unknown): value is Float32Array {
  return Object.prototype.toString.call(value) === '[object Float32Array]'
}

function isCellArray(value: unknown, cells: number): boolean {
  return isFloat32Array(value) && value.length === cells
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
  if (!hasScalars(s['bucket'], ['amount', 'water'])) return false
  if (!hasScalars(s['camera'], ['zoom', 'panX', 'panZ'])) return false

  if (typeof s['toolMode'] !== 'string' || !TOOL_MODES.includes(s['toolMode'])) return false
  if (typeof s['paused'] !== 'boolean' || typeof s['lookEnabled'] !== 'boolean') return false
  if (s['seed'] !== null && typeof s['seed'] !== 'string') return false

  return true
}

// Brings an older save up to this version, or hands back anything else as it
// came for isValidSnapshot to judge. Never mutates what it is given. Each step
// takes a save one version on, so a v1 save goes through both.
export function migrateSnapshot(value: unknown): unknown {
  return fromVersion2(fromVersion1(value))
}

// v1 -> v2: moisture was a fraction of what the sand could hold, and becomes
// the water itself. Each cell keeps the saturation it had, so the beach looks
// as it did; bare rock holds nothing, since wet rock reads wet from the water
// above it. The v1 bucket carried no water, so its sand is dry.
function fromVersion1(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const s = value as Record<string, unknown>
  if (s['version'] !== 1) return value

  const grid = s['grid'] as Record<string, unknown> | null | undefined
  const bucket = s['bucket'] as Record<string, unknown> | null | undefined
  if (typeof grid !== 'object' || grid === null) return value
  if (typeof bucket !== 'object' || bucket === null) return value
  const sand = grid['sand']
  const fraction = grid['moisture']
  if (!isFloat32Array(sand) || !isFloat32Array(fraction) || fraction.length !== sand.length) return value

  const held = new Float32Array(fraction.length)
  for (let i = 0; i < held.length; i++) held[i] = fraction[i]! * POROSITY * sand[i]!

  return {
    ...s,
    version: 2,
    grid: { ...grid, moisture: held },
    bucket: { ...bucket, water: 0 },
  }
}

// v2 -> v3: the seed. Every beach before seeds existed was the classic one, so
// this is a fact about the save rather than a guess.
function fromVersion2(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const s = value as Record<string, unknown>
  if (s['version'] !== 2) return value

  return { ...s, version: 3, seed: null }
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
    const stored = migrateSnapshot(await store.load())
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
  bucket: { amount: number; water: number }
  camera: { snapshot(): CameraSnapshot }
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
  seed: BeachSeed
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
    bucket: { amount: sources.bucket.amount, water: sources.bucket.water },
    camera: sources.camera.snapshot(),
    toolMode: sources.toolMode,
    paused: sources.paused,
    lookEnabled: sources.lookEnabled,
    seed: sources.seed,
  }
}

export interface SnapshotTargets {
  grid: { restore(snapshot: GridSnapshot): void }
  waterSim: { restore(snapshot: WaterSimSnapshot): void }
  waves: { restore(snapshot: WavesSnapshot): void }
  tide: { restore(snapshot: TideSnapshot): void }
  bucket: { setAmount(amount: number): void; setWater(water: number): void }
  camera: { restore(snapshot: CameraSnapshot): void }
}

export function applySnapshot(targets: SnapshotTargets, snapshot: GameSnapshot): void {
  targets.grid.restore(snapshot.grid)
  targets.waterSim.restore(snapshot.water)
  targets.waves.restore(snapshot.waves)
  targets.tide.restore(snapshot.tide)
  targets.bucket.setAmount(snapshot.bucket.amount)
  targets.bucket.setWater(snapshot.bucket.water)
  targets.camera.restore(snapshot.camera)
}

// A beach as it is before anyone has dug it, expressed as a snapshot so that
// starting over reuses the one path boot and import already take rather than
// adding a reset() to each of the six components that hold state.
//
// Built from real components rather than a hand-written literal: a fresh game
// is whatever a fresh Grid, WaterSim, Waves and Tide say it is, so this cannot
// drift from what a first-ever boot produces.
//
// The camera it carries is the one a first boot starts at. startNewGame is
// what a player's New game goes through, and that leaves the view alone.
export function newGameSnapshot(width: number, depth: number): GameSnapshot {
  const grid = new Grid(width, depth)
  grid.initBeach()
  grid.initSpring(STREAM_RATE)

  return {
    version: SNAPSHOT_VERSION,
    width,
    depth,
    grid: grid.snapshot(),
    water: new WaterSim(width, depth).snapshot(),
    waves: new Waves(width, depth).snapshot(),
    tide: new Tide().snapshot(),
    bucket: { amount: 0, water: 0 },
    camera: DEFAULT_CAMERA,
    toolMode: ToolMode.Spade,
    paused: false,
    lookEnabled: false,
    seed: null,
  }
}

// Lays a fresh beach over whatever the player had, leaving the camera where
// they left it: the new beach occupies the same world, so pulling the view
// back to the default would read as a lost position rather than a new game.
export function startNewGame(
  targets: Omit<SnapshotTargets, 'camera'>,
  width: number,
  depth: number,
): GameSnapshot {
  const snapshot = newGameSnapshot(width, depth)
  applySnapshot({ ...targets, camera: { restore: () => {} } }, snapshot)
  return snapshot
}
