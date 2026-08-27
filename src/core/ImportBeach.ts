import { applySnapshot } from './GameSnapshot.ts'
import { parseGameFile } from './GameFile.ts'
import type { GameSnapshot, SnapshotTargets } from './GameSnapshot.ts'

// Importing cannot be undone, and the next autosave overwrites the stored
// beach with the imported one.
export const REPLACE_WARNING = 'Replace the current beach? This cannot be undone.'

// Why a file that will not load is refused before the player is asked: there
// is nothing to weigh up if there is no beach in it, and asking first would
// make them agree to lose their beach only to be told the file was no good.
export type ImportRefusal = 'not-a-beach' | 'cancelled'

export interface ImportOutcome {
  imported: GameSnapshot | null
  refusal: ImportRefusal | null
}

// Asking is passed in rather than reaching for window.confirm, so the decision
// and what follows from it can be tested apart from the browser. A refused
// file and a declined import both leave the beach alone but are different
// things to tell the player, so the reason comes back alongside the result.
export function confirmImport(
  targets: SnapshotTargets,
  text: string,
  width: number,
  depth: number,
  ask: (message: string) => boolean,
): ImportOutcome {
  const snapshot = parseGameFile(text, width, depth)
  if (snapshot === null) return { imported: null, refusal: 'not-a-beach' }
  if (!ask(REPLACE_WARNING)) return { imported: null, refusal: 'cancelled' }

  applySnapshot(targets, snapshot)
  return { imported: snapshot, refusal: null }
}
