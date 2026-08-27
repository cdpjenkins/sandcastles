import { startNewGame } from './GameSnapshot.ts'
import type { GameSnapshot, SnapshotTargets } from './GameSnapshot.ts'

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
  ask: (message: string) => boolean,
): GameSnapshot | null {
  if (!ask(NEW_GAME_WARNING)) return null
  return startNewGame(targets, width, depth)
}
