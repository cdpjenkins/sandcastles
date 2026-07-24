const DEFAULT_PERIOD = 180
const DEFAULT_AMPLITUDE = 0.8

export class Tide {
  readonly period: number
  readonly amplitude: number

  private elapsed = 0

  constructor(period: number = DEFAULT_PERIOD, amplitude: number = DEFAULT_AMPLITUDE) {
    this.period = period
    this.amplitude = amplitude
  }

  step(dt: number): void {
    this.elapsed += dt
  }

  get offset(): number {
    return this.amplitude * Math.sin((2 * Math.PI * this.elapsed) / this.period)
  }
}
