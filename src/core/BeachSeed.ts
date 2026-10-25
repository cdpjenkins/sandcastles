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

// What the v1 generator lays its noise out with. Seed 0 is the classic beach.
export function noiseSeed(seed: BeachSeed): number {
  return seed === null ? 0 : seedFromText(seed.trim())
}

export const SEED_ADJECTIVES = [
  'salty', 'sandy', 'windy', 'sunny', 'misty', 'golden', 'quiet', 'rocky',
  'breezy', 'shady', 'stormy', 'pebbly', 'sleepy', 'bright', 'grey', 'wild',
] as const

export const SEED_NOUNS = [
  'gull', 'crab', 'shell', 'dune', 'cove', 'tern', 'kelp', 'reef',
  'pier', 'spade', 'bucket', 'tide', 'wave', 'shore', 'rockpool', 'driftwood',
] as const

// Something a player can read aloud and type back in, e.g. salty-gull-42.
// The random source is passed in so the choice can be pinned in a test.
export function randomSeed(random: () => number): string {
  const pick = <T>(words: readonly T[]): T => words[Math.floor(random() * words.length)]!
  const adjective = pick(SEED_ADJECTIVES)
  const noun = pick(SEED_NOUNS)
  const number = 10 + Math.floor(random() * 90)
  return `${adjective}-${noun}-${number}`
}
