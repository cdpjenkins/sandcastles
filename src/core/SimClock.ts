export class SimClock {
  private readonly stepSeconds: number
  private readonly maxFrameSeconds: number
  private accumulator = 0

  constructor(stepSeconds: number, maxFrameSeconds: number) {
    this.stepSeconds = stepSeconds
    this.maxFrameSeconds = maxFrameSeconds
  }

  advance(frameSeconds: number): number {
    this.accumulator += Math.min(frameSeconds, this.maxFrameSeconds)
    let steps = 0
    while (this.accumulator >= this.stepSeconds) {
      this.accumulator -= this.stepSeconds
      steps++
    }
    return steps
  }
}
