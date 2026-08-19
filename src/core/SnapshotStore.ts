import type { GameSnapshot } from './GameSnapshot.ts'

export interface SnapshotStore {
  load(): Promise<unknown>
  save(snapshot: GameSnapshot): Promise<void>
}
