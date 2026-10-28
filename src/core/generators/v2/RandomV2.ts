// mulberry32: a small seeded generator, so v2's draws are deterministic.
// Not yet frozen, like the rest of v2, but changing it changes every v2
// beach's shape and spring.
export function seededRandomV2(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
