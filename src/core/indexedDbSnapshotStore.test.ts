import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IndexedDbSnapshotStore } from './IndexedDbSnapshotStore.ts'
import { loadSnapshot, SNAPSHOT_VERSION } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import { ToolMode } from '../input/Tools.ts'

const W = 8, D = 8

function snap(): GameSnapshot {
  const c = () => new Float32Array(W * D)
  return {
    version: SNAPSHOT_VERSION, width: W, depth: D,
    grid: { rock: c(), sand: c(), water: c(), moisture: c(), source: c(), sediment: c() },
    water: { flowX: c(), flowZ: c() },
    waves: { elapsed: 3.25, timeUntilWave: 1.5 },
    tide: { elapsed: 47.5 },
    bucket: { amount: 321 },
    camera: { zoom: 120, panX: 30, panZ: 60 },
    toolMode: ToolMode.Dump, paused: true, lookEnabled: true,
  }
}

describe('IndexedDbSnapshotStore against a real IndexedDB', () => {
  beforeEach(async () => {
    // Clear rather than deleteDatabase: a delete blocks on any open
    // connection, and the store holds one for the life of the page.
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('sandcastles', 1)
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains('saves')) r.result.createObjectStore('saves')
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    await new Promise<void>((res) => {
      const tx = db.transaction('saves', 'readwrite')
      tx.objectStore('saves').clear()
      tx.oncomplete = () => res()
    })
    db.close()
  })

  it('returns undefined when nothing has been saved', async () => {
    expect(await new IndexedDbSnapshotStore().load()).toBeUndefined()
  })

  it('loadSnapshot yields null on a first-ever run', async () => {
    expect(await loadSnapshot(new IndexedDbSnapshotStore(), W, D)).toBeNull()
  })

  it('round-trips a snapshot through the database', async () => {
    const store = new IndexedDbSnapshotStore()
    const original = snap()
    original.grid.sand[7] = 9.5
    original.water.flowX[3] = -2.25

    await store.save(original)
    const loaded = await loadSnapshot(new IndexedDbSnapshotStore(), W, D)

    expect(loaded).not.toBeNull()
    expect(Array.from(loaded!.grid.sand)).toEqual(Array.from(original.grid.sand))
    expect(Array.from(loaded!.water.flowX)).toEqual(Array.from(original.water.flowX))
    expect(loaded!.tide.elapsed).toBe(47.5)
    expect(loaded!.waves.elapsed).toBe(3.25)
    expect(loaded!.bucket.amount).toBe(321)
    expect(loaded!.camera).toEqual({ zoom: 120, panX: 30, panZ: 60 })
    expect(loaded!.toolMode).toBe(ToolMode.Dump)
    expect(loaded!.paused).toBe(true)
  })

  it('overwrites rather than accumulating saves', async () => {
    const store = new IndexedDbSnapshotStore()
    const first = snap(); first.tide.elapsed = 1
    const second = snap(); second.tide.elapsed = 2

    await store.save(first)
    await store.save(second)

    const loaded = await loadSnapshot(new IndexedDbSnapshotStore(), W, D)
    expect(loaded!.tide.elapsed).toBe(2)
  })

  it('rejects a stored save whose grid no longer matches', async () => {
    await new IndexedDbSnapshotStore().save(snap())

    expect(await loadSnapshot(new IndexedDbSnapshotStore(), 256, 256)).toBeNull()
  })

  it('survives a corrupted record', async () => {
    const store = new IndexedDbSnapshotStore()
    await store.save(snap())
    const db: IDBDatabase = await new Promise((res) => {
      const r = indexedDB.open('sandcastles', 1); r.onsuccess = () => res(r.result)
    })
    await new Promise<void>((res) => {
      const tx = db.transaction('saves', 'readwrite')
      tx.objectStore('saves').put({ version: 'nonsense' }, 'autosave')
      tx.oncomplete = () => res()
    })
    db.close()

    expect(await loadSnapshot(new IndexedDbSnapshotStore(), W, D)).toBeNull()
  })

  it('data survives the database being closed and reopened', async () => {
    await new IndexedDbSnapshotStore().save(snap())

    const reopened = await loadSnapshot(new IndexedDbSnapshotStore(), W, D)

    expect(reopened!.bucket.amount).toBe(321)
  })

  it('gets out of the way when another tab upgrades the database', async () => {
    // The store holds its connection open for the life of the page. Without
    // releasing it on versionchange, a second tab running a newer schema
    // hangs on open() until this tab is closed - and its onblocked path
    // means that tab silently loses its beach.
    const store = new IndexedDbSnapshotStore()
    await store.load()

    const outcome = await new Promise<string>((resolve) => {
      const request = indexedDB.open('sandcastles', 2)
      request.onsuccess = () => resolve('upgraded')
      request.onblocked = () => resolve('blocked')
      request.onerror = () => resolve('error')
    })

    expect(outcome).toBe('upgraded')
  })
})
