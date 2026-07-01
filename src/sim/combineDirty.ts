export function orInto(target: Uint8Array, ...sources: Uint8Array[]): void {
  target.fill(0)
  for (const source of sources) {
    for (let i = 0; i < target.length; i++) {
      if (source[i]) target[i] = 1
    }
  }
}
