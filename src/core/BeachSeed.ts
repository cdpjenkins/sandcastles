// A beach's seed is text the player can read, type and share; null is the
// classic beach. Classic is not a text so that no typed seed can collide with it.
export type BeachSeed = string | null

// FNV-1a over UTF-16 code units. This is part of the save format - a stored
// seed regenerates its beach through it - so it must never change.
export function seedFromText(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h | 0
}

// What initBeach is given. Seed 0 is the classic beach.
export function noiseSeed(seed: BeachSeed): number {
  return seed === null ? 0 : seedFromText(seed.trim())
}
