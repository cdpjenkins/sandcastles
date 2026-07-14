const DEFAULT_PERIOD = 180
const DEFAULT_RANGE = 0.4

export class Tide {
  readonly period: number
  readonly range: number

  private elapsed = 0

  constructor(period: number = DEFAULT_PERIOD, range: number = DEFAULT_RANGE) {
    this.period = period
    this.range = range
  }

  step(dt: number): void {
    this.elapsed += dt
  }

  get offset(): number {
    return this.range * Math.sin((2 * Math.PI * this.elapsed) / this.period)
  }
}
