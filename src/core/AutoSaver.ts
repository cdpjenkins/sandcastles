import type { GameSnapshot } from './GameSnapshot.ts'
import type { SnapshotStore } from './SnapshotStore.ts'

export class AutoSaver {
  private readonly store: SnapshotStore
  private readonly intervalSeconds: number
  private readonly takeSnapshot: () => GameSnapshot
  private sinceLastSave = 0
  private saving = false

  constructor(
    store: SnapshotStore,
    intervalSeconds: number,
    takeSnapshot: () => GameSnapshot,
  ) {
    this.store = store
    this.intervalSeconds = intervalSeconds
    this.takeSnapshot = takeSnapshot
  }

  tick(elapsedSeconds: number): void {
    this.sinceLastSave += elapsedSeconds
    if (this.sinceLastSave < this.intervalSeconds) return
    this.sinceLastSave = 0
    this.startSave()
  }

  saveNow(): void {
    this.sinceLastSave = 0
    this.startSave()
  }

  private startSave(): void {
    if (this.saving) return
    this.saving = true
    void this.store
      .save(this.takeSnapshot())
      .catch(() => {})
      .finally(() => {
        this.saving = false
      })
  }
}
