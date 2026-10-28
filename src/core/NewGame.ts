import { startNewGame } from './GameSnapshot.ts'
import type { GameSnapshot, SnapshotTargets } from './GameSnapshot.ts'
import { randomSeed } from './BeachSeed.ts'
import { CLASSIC_BEACH, LATEST_GENERATOR } from './generators/BeachGenerator.ts'
import type { BeachSpec } from './generators/BeachGenerator.ts'

// What the player picked in the new-game chooser, before it becomes a beach.
export type NewGameChoice =
  | { kind: 'classic' }
  | { kind: 'restart' }
  | { kind: 'random' }
  | { kind: 'chosen'; text: string; generator: number }

// Which beach a choice grows. A random seed is grown by the newest generator,
// a typed one by whichever the player picked, so a seed from an older game
// grows the beach it grew there; a restart regrows this beach with the
// generator that grew it; classic is v1's.
//
// The random source is passed in so a random beach can be pinned in a test.
// A chosen seed is stored trimmed, so what the Hud shows is what was hashed.
export function resolveBeach(
  choice: NewGameChoice,
  current: BeachSpec,
  random: () => number,
): BeachSpec {
  switch (choice.kind) {
    case 'classic': return { ...CLASSIC_BEACH }
    case 'restart': return { ...current }
    case 'random': return { generator: LATEST_GENERATOR, seed: randomSeed(random) }
    case 'chosen': return { generator: choice.generator, seed: choice.text.trim() }
  }
}

// Starting over destroys the beach with no undo, and the next autosave
// overwrites the stored one, so the player is told both.
export const NEW_GAME_WARNING =
  'Start a new game? The beach you have built will be lost, and this cannot be undone.'

// Asking is passed in rather than reaching for window.confirm, so the decision
// and what follows from it can be tested apart from the browser.  Returns the
// state the new game starts in, or null if the player said no - which the
// caller reads as "change nothing".
export function confirmNewGame(
  targets: Omit<SnapshotTargets, 'camera'>,
  width: number,
  depth: number,
  spec: BeachSpec,
  ask: (message: string) => boolean,
): GameSnapshot | null {
  if (!ask(NEW_GAME_WARNING)) return null
  return startNewGame(targets, width, depth, spec)
}
