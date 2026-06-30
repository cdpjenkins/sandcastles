export class WaveAudio {
  private ctx: AudioContext | null = null

  play(): void {
    if (!this.ctx) this.ctx = new AudioContext()
    const ctx = this.ctx

    const bufSize = ctx.sampleRate * 0.6
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.15))
      data[i] = (Math.random() * 2 - 1) * env
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600

    const gain = ctx.createGain()
    gain.gain.value = 0.25

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  }
}
