import { describe, it, expect } from 'vitest'
import { AutoSaver } from './AutoSaver.ts'
import type { GameSnapshot } from './GameSnapshot.ts'

const INTERVAL = 5

// The saver never looks inside a snapshot, it only routes one from the game to
// the store. So these stand in for snapshots by identity, which keeps the test
// about scheduling rather than about save format.
function aSnapshot(label: string): GameSnapshot {
  return { label } as unknown as GameSnapshot
}

function aStore() {
  const saved: GameSnapshot[] = []
  const pending: Array<{ resolve: () => void; reject: (e: Error) => void }> = []
  return {
    saved,
    pending,
    load: () => Promise.resolve(null),
    save(snapshot: GameSnapshot) {
      saved.push(snapshot)
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
    },
    async settle(index = 0) {
      pending[index]!.resolve()
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('AutoSaver', () => {
  it('does not save before the interval has elapsed', () => {
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.tick(INTERVAL - 0.1)

    expect(store.saved).toHaveLength(0)
  })

  it('saves once the interval has elapsed', () => {
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.tick(INTERVAL)

    expect(store.saved).toHaveLength(1)
  })

  it('saves what the game hands it', () => {
    const store = aStore()
    const snapshot = aSnapshot('the beach')
    const saver = new AutoSaver(store, INTERVAL, () => snapshot)

    saver.tick(INTERVAL)

    expect(store.saved[0]).toBe(snapshot)
  })

  it('does not save again until another whole interval has passed', async () => {
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.tick(INTERVAL)
    await store.settle()
    saver.tick(INTERVAL - 0.1)

    expect(store.saved).toHaveLength(1)
  })

  it('skips a save while one is still in flight rather than queueing it', async () => {
    // A 2 MiB write can outlast the interval on a loaded machine. Queueing
    // would turn one stall into an unbounded backlog of stale snapshots.
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.tick(INTERVAL)
    saver.tick(INTERVAL)
    saver.tick(INTERVAL)

    expect(store.saved).toHaveLength(1)
  })

  it('saves again once the in-flight write finishes', async () => {
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.tick(INTERVAL)
    await store.settle()
    saver.tick(INTERVAL)

    expect(store.saved).toHaveLength(2)
  })

  it('keeps saving after a write fails', async () => {
    // Storage can reject for reasons that pass: a quota prompt, a private
    // window. One failure must not end autosaving for the session.
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.tick(INTERVAL)
    store.pending[0]!.reject(new Error('quota exceeded'))
    await Promise.resolve()
    await Promise.resolve()
    saver.tick(INTERVAL)

    expect(store.saved).toHaveLength(2)
  })

  it('does not copy the world when no save is due', () => {
    // takeSnapshot copies 2 MiB, so calling it on a tick that saves nothing
    // would put that cost on every frame.
    const store = aStore()
    let copies = 0
    const saver = new AutoSaver(store, INTERVAL, () => {
      copies++
      return aSnapshot('a')
    })

    saver.tick(INTERVAL - 0.1)

    expect(copies).toBe(0)
  })

  it('saves on demand whatever the interval says', () => {
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.saveNow()

    expect(store.saved).toHaveLength(1)
  })

  it('an on-demand save restarts the interval', async () => {
    const store = aStore()
    const saver = new AutoSaver(store, INTERVAL, () => aSnapshot('a'))

    saver.saveNow()
    await store.settle()
    saver.tick(INTERVAL - 0.1)

    expect(store.saved).toHaveLength(1)
  })
})
