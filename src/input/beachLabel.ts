import type { BeachSpec } from '../core/generators/BeachGenerator.ts'

// How a beach is named to the player: its seed, or classic, and the generator
// that grew it. "gen", never a bare "v": a save also carries a save-format
// version, which changes for unrelated reasons, and a "v1" beside a format of
// 4 invites confusing the two.
export function beachLabel(beach: BeachSpec): string {
  return `${beach.seed ?? 'classic'} (gen ${beach.generator})`
}
