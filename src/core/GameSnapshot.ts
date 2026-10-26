import { Grid } from './Grid.ts'
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
import { generatorFor } from './generators/BeachGenerator.ts'
import type { BeachGenerator, BeachSpec } from './generators/BeachGenerator.ts'
import { seaV1 } from './generators/v1/BeachGeneratorV1.ts'
import type { BeachSeed } from './BeachSeed.ts'
import { seaProblem } from './BeachSea.ts'
import type { BeachSea } from './BeachSea.ts'

// 2: moisture holds water rather than a 0-1 fraction, and the bucket carries
// water. 3: the seed the beach grew from. 4: the generator that grew it, and
// the beach's own sea. 5: the whole sea, tide and swell included, as one
// value. migrateSnapshot reads a 1, 2, 3 or 4.
export const SNAPSHOT_VERSION = 5

export const GRID_LAYERS = ['rock', 'sand', 'water', 'moisture', 'source', 'sediment'] as const
export const FLOW_LAYERS = ['flowX', 'flowZ'] as const
const SEA_FIELDS: readonly (keyof BeachSea)[] = [
  'seaStart', 'seaLevel', 'tideAmplitude', 'tidePeriod', 'swellFrequency', 'swellStrength',
]

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
  // Which generator grew the beach, so a restart regrows it the same way.
  generator: number
  // The beach's own sea: a generator chooses it, so it is stored, not derived.
  sea: BeachSea
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

// The generator lookup is a parameter only so a test can stand in a generator
// with no classic beach, which does not exist yet.
export function isValidSnapshot(
  value: unknown,
  width: number,
  depth: number,
  generators: (version: number) => BeachGenerator | null = generatorFor,
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

  // A beach this game cannot regrow is refused, and so is a classic beach from
  // a generator that has none: classic is a v1 idea.
  const generator = typeof s['generator'] === 'number' ? generators(s['generator']) : null
  if (generator === null) return false
  if (s['seed'] === null && !generator.hasClassic) return false

  // seaProblem is what the grid's setSea throws on, so a sea let through here
  // can never fail halfway through restoring a beach.
  if (!hasScalars(s['sea'], SEA_FIELDS)) return false
  if (seaProblem(s['sea'] as BeachSea, depth) !== null) return false

  return true
}

// Brings an older save up to this version, or hands back anything else as it
// came for isValidSnapshot to judge. Never mutates what it is given. Each step
// takes a save one version on, so a v1 save goes through both.
export function migrateSnapshot(value: unknown): unknown {
  return fromVersion4(fromVersion3(fromVersion2(fromVersion1(value))))
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

// v3 -> v4: the generator and the sea. Every beach before generators were
// versioned was grown by what became v1, with v1's sea - a fact, not a guess.
function fromVersion3(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const s = value as Record<string, unknown>
  if (s['version'] !== 3 || typeof s['depth'] !== 'number') return value

  const { seaStart, seaLevel } = seaV1(s['depth'])
  return { ...s, version: 4, generator: 1, seaStart, seaLevel }
}

// v4 -> v5: the whole sea as one value. A v4 save stored only where its sea
// started and how high it stood; every beach that could be saved then was
// grown by v1, so its tide and swell are v1's - a fact, not a guess.
function fromVersion4(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const s = value as Record<string, unknown>
  if (s['version'] !== 4 || typeof s['depth'] !== 'number') return value

  const { seaStart, seaLevel, ...rest } = s
  return { ...rest, version: 5, sea: { ...seaV1(s['depth']), seaStart, seaLevel } }
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
  grid: { width: number; depth: number; sea: Readonly<BeachSea>; snapshot(): GridSnapshot }
  waterSim: { snapshot(): WaterSimSnapshot }
  waves: { snapshot(): WavesSnapshot }
  tide: { snapshot(): TideSnapshot }
  bucket: { amount: number; water: number }
  camera: { snapshot(): CameraSnapshot }
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
  seed: BeachSeed
  generator: number
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
    generator: sources.generator,
    sea: { ...sources.grid.sea },
  }
}

export interface SnapshotTargets {
  grid: { restore(snapshot: GridSnapshot): void; setSea(sea: BeachSea): void }
  waterSim: { restore(snapshot: WaterSimSnapshot): void }
  waves: { restore(snapshot: WavesSnapshot): void }
  tide: { restore(snapshot: TideSnapshot): void }
  bucket: { setAmount(amount: number): void; setWater(water: number): void }
  camera: { restore(snapshot: CameraSnapshot): void }
}

export function applySnapshot(targets: SnapshotTargets, snapshot: GameSnapshot): void {
  targets.grid.restore(snapshot.grid)
  targets.grid.setSea(snapshot.sea)
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
export function newGameSnapshot(width: number, depth: number, spec: BeachSpec): GameSnapshot {
  const generator = generatorFor(spec.generator)
  if (generator === null) throw new Error(`no beach generator version ${spec.generator}`)
  const grid = new Grid(width, depth)
  generator.generate(grid, spec.seed)
  // The first wave comes one of this beach's periods in, not the harshest
  // swell's, which is all a Waves knows before it has seen a grid.
  const waves = new Waves(width, depth)
  waves.timeUntilWave = waves.period(grid)

  return {
    version: SNAPSHOT_VERSION,
    width,
    depth,
    grid: grid.snapshot(),
    water: new WaterSim(width, depth).snapshot(),
    waves: waves.snapshot(),
    tide: new Tide().snapshot(),
    bucket: { amount: 0, water: 0 },
    camera: DEFAULT_CAMERA,
    toolMode: ToolMode.Spade,
    paused: false,
    lookEnabled: false,
    seed: spec.seed,
    generator: spec.generator,
    sea: { ...grid.sea },
  }
}

// Lays a fresh beach over whatever the player had, leaving the camera where
// they left it: the new beach occupies the same world, so pulling the view
// back to the default would read as a lost position rather than a new game.
export function startNewGame(
  targets: Omit<SnapshotTargets, 'camera'>,
  width: number,
  depth: number,
  spec: BeachSpec,
): GameSnapshot {
  const snapshot = newGameSnapshot(width, depth, spec)
  applySnapshot({ ...targets, camera: { restore: () => {} } }, snapshot)
  return snapshot
}
