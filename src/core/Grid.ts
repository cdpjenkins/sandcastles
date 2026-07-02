const SEA_FRACTION = 0.75

export class Grid {
  readonly width: number
  readonly depth: number
  readonly seaStart: number

  private readonly rock: Float32Array
  private readonly sand: Float32Array
  private readonly water: Float32Array
  private readonly moisture: Float32Array
  private readonly source: Float32Array
  private readonly sedimentArr: Float32Array

  constructor(width: number, depth: number) {
    this.width = width
    this.depth = depth
    this.seaStart = Math.floor(depth * SEA_FRACTION)
    const size = width * depth
    this.rock = new Float32Array(size)
    this.sand = new Float32Array(size)
    this.water = new Float32Array(size)
    this.moisture = new Float32Array(size)
    this.source = new Float32Array(size)
    this.sedimentArr = new Float32Array(size)
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

  initBeach(): void {
    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.idx(x, z)
        this.rock[i] = 1.0

        if (z >= this.seaStart) {
          this.sand[i] = 0
          this.water[i] = 1.0
        } else {
          const t = z / this.seaStart
          const base = 30 * Math.pow(1 - t, 2)
          const noise = Grid.fractalNoise(x, z) * 20
          this.sand[i] = Math.max(0, base + noise)
        }
      }
    }
  }

  private static hashNoise(xi: number, zi: number): number {
    let h = (Math.imul(xi, 374761393) + Math.imul(zi, 668265263)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = h ^ (h >>> 16)
    return (h & 0xffff) / 32767.5 - 1
  }

  private static smoothNoise(x: number, z: number): number {
    const xi = Math.floor(x)
    const zi = Math.floor(z)
    const fx = x - xi
    const fz = z - zi
    const ux = fx * fx * (3 - 2 * fx)
    const uz = fz * fz * (3 - 2 * fz)
    const a = Grid.hashNoise(xi, zi)
    const b = Grid.hashNoise(xi + 1, zi)
    const c = Grid.hashNoise(xi, zi + 1)
    const d = Grid.hashNoise(xi + 1, zi + 1)
    const ab = a + (b - a) * ux
    const cd = c + (d - c) * ux
    return ab + (cd - ab) * uz
  }

  private static fractalNoise(x: number, z: number): number {
    const freqs = [1 / 64, 1 / 32, 1 / 16, 1 / 8]
    const amps  = [1,      0.65,   0.422,  0.274]
    let value = 0
    let total = 0
    for (let o = 0; o < freqs.length; o++) {
      value += Grid.smoothNoise(x * freqs[o], z * freqs[o]) * amps[o]
      total += amps[o]
    }
    return value / total
  }
}
