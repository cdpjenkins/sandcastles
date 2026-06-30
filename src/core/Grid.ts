export class Grid {
  readonly width: number
  readonly depth: number

  private readonly rock: Float32Array
  private readonly sand: Float32Array
  private readonly water: Float32Array
  private readonly moisture: Float32Array
  private readonly source: Float32Array

  constructor(width: number, depth: number) {
    this.width = width
    this.depth = depth
    const size = width * depth
    this.rock = new Float32Array(size)
    this.sand = new Float32Array(size)
    this.water = new Float32Array(size)
    this.moisture = new Float32Array(size)
    this.source = new Float32Array(size)
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

  initBeach(): void {
    const seaStart = Math.floor(this.depth * 0.75)

    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.idx(x, z)
        this.rock[i] = 1.0

        if (z >= seaStart) {
          this.sand[i] = 0
          this.water[i] = 1.0
        } else {
          const t = 1 - z / seaStart
          this.sand[i] = t * 30.0
        }
      }
    }
  }
}
