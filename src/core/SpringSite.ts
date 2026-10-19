import type { Grid } from './Grid.ts'
import type { GridCoord } from '../types.ts'
import { seedFromText } from './BeachSeed.ts'

// How much a spring may have to fill and still be sure of reaching the sea:
// across the 50-seed sweep every spring scoring under 70 arrived inside 300s,
// and the lowest that did not scored 133. Coupled to STREAM_RATE and the
// world's unit scale - it is roughly "70 seconds of spring" - and measured, not
// chosen.
export const MAX_SPRING_FILL = 70

// How many rows below the highest good spot still count as high: room for the
// seed to choose without giving up much of the stream's length.
export const SPRING_ROW_BAND = 4

// The x-walls reflect; a spring hard against one runs down the wall.
export const SPRING_SIDE_MARGIN = 8

// Below this, a cell counts as standing at its fill level rather than under it.
const HOLLOW_EPSILON = 1e-6

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

// A binary min-heap of cell indices keyed by height: the priority flood's queue.
class CellHeap {
  private readonly keys: number[] = []
  private readonly cells: number[] = []

  get size(): number {
    return this.cells.length
  }

  push(key: number, cell: number): void {
    const { keys, cells } = this
    let k = cells.length
    keys.push(key)
    cells.push(cell)
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (keys[parent]! <= key) break
      keys[k] = keys[parent]!
      cells[k] = cells[parent]!
      k = parent
    }
    keys[k] = key
    cells[k] = cell
  }

  pop(): number {
    const { keys, cells } = this
    const top = cells[0]!
    const lastKey = keys.pop()!
    const lastCell = cells.pop()!
    const n = cells.length
    if (n === 0) return top
    let k = 0
    for (;;) {
      const left = 2 * k + 1
      if (left >= n) break
      const right = left + 1
      const child = right < n && keys[right]! < keys[left]! ? right : left
      if (keys[child]! >= lastKey) break
      keys[k] = keys[child]!
      cells[k] = cells[child]!
      k = child
    }
    keys[k] = lastKey
    cells[k] = lastCell
    return top
  }
}

// How much water a spring at each cell must pour into hollows before its
// stream can reach the sea: the volume of every hollow on its way down, read
// off the terrain alone. Against the sim it is conservative - a spring scoring
// under 70 has always reached the sea - which is the safe direction for
// choosing where one goes.
//
// One priority flood inward from the sea gives every cell its fill level (the
// lowest it could drain at) and the neighbour it drains through. Following
// those is a cell's route to the sea, so one pass scores every cell; flooding
// out from each candidate instead took 3s on the full beach.
export function fillCost(grid: Grid): Float32Array {
  const { width, depth } = grid
  const cells = width * depth
  const surface = new Float32Array(cells)
  const water = new Float32Array(cells)
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      surface[z * width + x] = grid.getSurfaceHeight(x, z)!
      water[z * width + x] = grid.getWaterHeight(x, z)!
    }
  }

  const forEachNeighbour = (i: number, visit: (j: number) => void): void => {
    const x = i % width
    const z = (i - x) / width
    for (const [dx, dz] of NEIGHBOURS) {
      const nx = x + dx
      const nz = z + dz
      if (nx >= 0 && nx < width && nz >= 0 && nz < depth) visit(nz * width + nx)
    }
  }

  // The sea: its rows, and water joined to them. A pool inland is a lake
  // however low it lies, and counting it as the sea let springs that drained
  // into one score as if they had arrived.
  const sea = new Uint8Array(cells)
  const joining: number[] = []
  for (let i = grid.seaStart * width; i < cells; i++) {
    sea[i] = 1
    joining.push(i)
  }
  while (joining.length > 0) {
    forEachNeighbour(joining.pop()!, (j) => {
      if (sea[j] || water[j]! <= 0) return
      sea[j] = 1
      joining.push(j)
    })
  }

  const fill = new Float32Array(cells).fill(Infinity)
  const drainsTo = new Int32Array(cells).fill(-1)
  const floodOrder: number[] = []
  const queue = new CellHeap()
  for (let i = 0; i < cells; i++) {
    if (!sea[i]) continue
    fill[i] = surface[i]!
    queue.push(surface[i]!, i)
  }
  while (queue.size > 0) {
    const i = queue.pop()
    floodOrder.push(i)
    forEachNeighbour(i, (j) => {
      if (fill[j] !== Infinity) return
      fill[j] = Math.max(fill[i]!, surface[j]!)
      drainsTo[j] = i
      queue.push(fill[j]!, j)
    })
  }

  // Hollows: connected cells standing below their fill level, each with the
  // volume it holds.
  const isHollow = (i: number): boolean => !sea[i] && fill[i]! - surface[i]! > HOLLOW_EPSILON
  const hollow = new Int32Array(cells).fill(-1)
  const volume: number[] = []
  for (let start = 0; start < cells; start++) {
    if (hollow[start] !== -1 || !isHollow(start)) continue
    const id = volume.length
    let held = 0
    hollow[start] = id
    const members = [start]
    while (members.length > 0) {
      const i = members.pop()!
      held += fill[i]! - surface[i]!
      forEachNeighbour(i, (j) => {
        if (hollow[j] !== -1 || !isHollow(j)) return
        hollow[j] = id
        members.push(j)
      })
    }
    volume.push(held)
  }

  // In flood order a cell's route is scored before anything draining into it,
  // so each cell is its drain's score plus any hollow it is the way into.
  const cost = new Float32Array(cells)
  for (const i of floodOrder) {
    const drain = drainsTo[i]!
    if (drain < 0) continue
    const entering = hollow[i]! >= 0 && hollow[i] !== hollow[drain]
    cost[i] = cost[drain]! + (entering ? volume[hollow[i]!]! : 0)
  }
  return cost
}

// mulberry32: a small seeded generator, so the spring's draw is deterministic.
function seededRandom(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Where a seeded beach's spring goes: on dry land, off the side walls, scoring
// within MAX_SPRING_FILL, and as high up the beach as that allows, so the
// stream is as long as the beach can give it. The seed picks among the spots
// in that top band, through a sub-seed of its own so the draw takes nothing
// from the noise.
//
// Where nothing is within budget - it never happened across 51 beaches, but
// the terrain is unbounded - the budget rises to the cheapest spot there is,
// and the same rule picks among those.
export function springSite(grid: Grid, seed: string): GridCoord {
  const { width, seaStart } = grid
  const cost = fillCost(grid)

  const candidates: number[] = []
  for (let z = 0; z < seaStart; z++) {
    for (let x = SPRING_SIDE_MARGIN; x < width - SPRING_SIDE_MARGIN; x++) {
      if (grid.getWaterHeight(x, z)! === 0) candidates.push(z * width + x)
    }
  }
  if (candidates.length === 0) throw new Error('no dry land for a spring')

  // A loop, not Math.min(...): the full beach has ~48k candidates, too many
  // arguments to spread safely - the same trap as String.fromCharCode in
  // base64Cells.
  let cheapest = Infinity
  for (const i of candidates) cheapest = Math.min(cheapest, cost[i]!)
  const budget = Math.max(MAX_SPRING_FILL, cheapest)
  const affordable = candidates.filter((i) => cost[i]! <= budget)

  // Row-major order, so the first is on the highest row.
  const top = Math.floor(affordable[0]! / width)
  const band = affordable.filter((i) => Math.floor(i / width) <= top + SPRING_ROW_BAND)

  // Trimmed as noiseSeed trims, or the same land would grow a different spring.
  const random = seededRandom(seedFromText(`${seed.trim()}:spring`))
  const chosen = band[Math.floor(random() * band.length)]!
  return { x: chosen % width, z: Math.floor(chosen / width) }
}
