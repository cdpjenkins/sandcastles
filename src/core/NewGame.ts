import { startNewGame } from './GameSnapshot.ts'
import type { GameSnapshot, SnapshotTargets } from './GameSnapshot.ts'
import { randomSeed } from './BeachSeed.ts'
import type { BeachSeed } from './BeachSeed.ts'

// What the player picked in the new-game chooser, before it becomes a seed.
export type NewGameChoice =
  | { kind: 'classic' }
  | { kind: 'restart' }
  | { kind: 'random' }
  | { kind: 'chosen'; text: string }

// The random source is passed in so a random beach can be pinned in a test.
// A chosen seed is stored trimmed, so what the Hud shows is what was hashed.
export function resolveSeed(
  choice: NewGameChoice,
  current: BeachSeed,
  random: () => number,
): BeachSeed {
  switch (choice.kind) {
    case 'classic': return null
    case 'restart': return current
    case 'random': return randomSeed(random)
    case 'chosen': return choice.text.trim()
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
  seed: BeachSeed,
  ask: (message: string) => boolean,
): GameSnapshot | null {
  if (!ask(NEW_GAME_WARNING)) return null
  return startNewGame(targets, width, depth, seed)
}
