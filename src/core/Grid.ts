import { defaultSea, seaProblem } from './BeachSea.ts'
import type { BeachSea } from './BeachSea.ts'

export const STREAM_RATE = 1.0

export interface GridSnapshot {
  rock: Float32Array
  sand: Float32Array
  water: Float32Array
  moisture: Float32Array
  source: Float32Array
  sediment: Float32Array
}

export class Grid {
  readonly width: number
  readonly depth: number
  // The sea is a value per beach, set by whatever lays the beach out and read
  // by the sim every step. A grid built without one keeps the sea every beach
  // has always had.
  private seaValue: Readonly<BeachSea>

  private readonly rock: Float32Array
  private readonly sand: Float32Array
  private readonly water: Float32Array
  private readonly moisture: Float32Array
  private readonly source: Float32Array
  private readonly sedimentArr: Float32Array

  constructor(width: number, depth: number) {
    this.width = width
    this.depth = depth
    this.seaValue = defaultSea(depth)
    const size = width * depth
    this.rock = new Float32Array(size)
    this.sand = new Float32Array(size)
    this.water = new Float32Array(size)
    this.moisture = new Float32Array(size)
    this.source = new Float32Array(size)
    this.sedimentArr = new Float32Array(size)
  }

  // The beach's whole sea. Read-only rather than a copy: the swell reads it
  // for every boundary and sponge cell, every step. setSea copies what it is
  // given, so it changes only through setSea.
  get sea(): Readonly<BeachSea> {
    return this.seaValue
  }

  // The first row of sea. Everything above it is land.
  get seaStart(): number {
    return this.seaValue.seaStart
  }

  // An elevation, never a depth: see CLAUDE.md.
  get seaLevel(): number {
    return this.seaValue.seaLevel
  }

  setSea(sea: BeachSea): void {
    const problem = seaProblem(sea, this.depth)
    if (problem !== null) throw new RangeError(problem)
    this.seaValue = { ...sea }
  }

  private inBounds(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth
  }

  private idx(x: number, z: number): number {
    return z * this.width + x
  }

  getRockHeight(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    return this.rock[this.idx(x, z)]
  }

  setRockHeight(x: number, z: number, h: number): void {
    if (!this.inBounds(x, z)) return
    this.rock[this.idx(x, z)] = h
  }

  getSandHeight(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    return this.sand[this.idx(x, z)]
  }

  setSandHeight(x: number, z: number, h: number): void {
    if (!this.inBounds(x, z)) return
    this.sand[this.idx(x, z)] = h
  }

  getWaterHeight(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    return this.water[this.idx(x, z)]
  }

  setWaterHeight(x: number, z: number, h: number): void {
    if (!this.inBounds(x, z)) return
    this.water[this.idx(x, z)] = h
  }

  getMoisture(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    return this.moisture[this.idx(x, z)]
  }

  setMoisture(x: number, z: number, v: number): void {
    if (!this.inBounds(x, z)) return
    this.moisture[this.idx(x, z)] = v
  }

  getSediment(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    return this.sedimentArr[this.idx(x, z)]
  }

  setSediment(x: number, z: number, v: number): void {
    if (!this.inBounds(x, z)) return
    this.sedimentArr[this.idx(x, z)] = v
  }

  getSourceRate(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    return this.source[this.idx(x, z)]
  }

  setSourceRate(x: number, z: number, rate: number): void {
    if (!this.inBounds(x, z)) return
    this.source[this.idx(x, z)] = rate
  }

  getSurfaceHeight(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    const i = this.idx(x, z)
    return this.rock[i] + this.sand[i]
  }

  getWaterSurfaceHeight(x: number, z: number): number | undefined {
    if (!this.inBounds(x, z)) return undefined
    const i = this.idx(x, z)
    return this.rock[i] + this.sand[i] + this.water[i]
  }

  getTotalSandHeight(): number {
    let total = 0
    for (let i = 0; i < this.sand.length; i++) total += this.sand[i]!
    return total
  }

  snapshot(): GridSnapshot {
    return {
      rock: this.rock.slice(),
      sand: this.sand.slice(),
      water: this.water.slice(),
      moisture: this.moisture.slice(),
      source: this.source.slice(),
      sediment: this.sedimentArr.slice(),
    }
  }

  restore(snapshot: GridSnapshot): void {
    this.rock.set(snapshot.rock)
    this.sand.set(snapshot.sand)
    this.water.set(snapshot.water)
    this.moisture.set(snapshot.moisture)
    this.source.set(snapshot.source)
    this.sedimentArr.set(snapshot.sediment)
  }
}
