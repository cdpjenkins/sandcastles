# Plan: survive a browser-initiated restart

## Context

### Why the app restarts

Chrome discards background tabs. Once a tab has been backgrounded and the system
is under memory pressure, Chrome first **freezes** it (Page Lifecycle API) and
then **discards** it, tearing down the renderer process. The tab stays on the
strip, but clicking back to it **reloads the page from scratch** — new document,
new JS heap, `new Game()` from line one. Everything in memory is gone. This is
deliberate Chrome behaviour (Memory Saver), not a crash, and a page cannot opt
out of it.

Two things make this app an attractive target:

- **It is memory-hungry.** A WebGL context with a 2048×2048 PCFSoft shadow map,
  ~2.7 MiB of live sim arrays, and ~3 MiB of `TerrainMesh` geometry with GPU-side
  copies. Nothing is ever disposed.
- **It allocates hard while running.** `Erosion.transportSediment`
  (`src/sim/Erosion.ts:86`) allocates three fresh `Float32Array(65536)` on *every*
  sim step — ~768 KiB per step at 30 Hz, roughly **23 MB/s of garbage**.

A secondary path to the same symptom: a page running a permanent
`requestAnimationFrame` loop with a live WebGL context is frequently ineligible
for the back/forward cache, so even an ordinary navigate-away-and-back returns as
a full reload rather than a restore.

**The app has no persistence of any kind** — greps for `localStorage`,
`sessionStorage`, `indexedDB`, `JSON`, `structuredClone`, `serialise`, service
workers and manifests return zero hits repo-wide. So a discard costs the whole
beach.

### What this plan does

Makes a discard a non-event: the game snapshots itself periodically and when the
tab is backgrounded, and silently restores on load. No save UI, no slots.
Restoration is **exact**, including tide and swell phase, so a resumed game is
indistinguishable from an uninterrupted one.

Reducing the memory pressure that provokes the discard (the `Erosion` churn
above) is a real fix worth doing, but it is a **separate change and out of scope
here**. Persistence is the robust answer; using less memory only makes the
discard rarer.

## Design

### Store: IndexedDB, holding typed arrays directly

The faithful snapshot is 8 × `Float32Array(65536)` = **exactly 2.00 MiB** plus
~12 scalars. That rules out `localStorage`: it is string-only, so 2 MiB becomes
~2.8M base64 chars ≈ 5.6 MB of UTF-16 quota against a ~5 MB limit, and the write
is synchronous on the main thread.

IndexedDB stores structured-cloneable values, and the structured clone algorithm
handles `Float32Array` natively. **So there is no serialisation format to write** —
we `put` a plain object with typed-array fields and get it back the same. No
base64, no manual binary packing, no `CompressionStream`.

### The testability problem, and the seam it forces

Measured under this project's actual vitest/jsdom config:

| global | jsdom |
| --- | --- |
| `indexedDB` | **`undefined`** |
| `structuredClone` | available |
| `localStorage` | available |
| `document.visibilityState` | `'visible'` (read-only getter) |

So **no IndexedDB code can be tested** without adding `fake-indexeddb`. Rather
than take the dependency, split at an interface:

```ts
// src/core/SnapshotStore.ts
export interface SnapshotStore {
  load(): Promise<unknown>              // unknown: whatever was on disk, unvalidated
  save(snapshot: GameSnapshot): Promise<void>
}
export class IndexedDbSnapshotStore implements SnapshotStore { /* thin wiring */ }
```

Everything that can actually be wrong — *what* to snapshot, whether a save is
valid, when to write — sits on the tested side against a hand-rolled in-memory
fake. Only the ~40 lines of `IDBRequest` plumbing go untested, and browser
verification covers them. This is the `SimClock` pattern PLAN.md argues for:
extract the risky logic, leave `Game` a mechanical wiring change.

`structuredClone` being available is the compensating gift: it is *the same
algorithm* IndexedDB serialises with, so round-tripping a snapshot through
`structuredClone` in jsdom is a genuine proof that the stored data survives
intact. That gets its own test step.

### Traps this feature has to avoid

**1. Async load versus synchronous construction.** Reading IndexedDB is async;
`new Game()` is synchronous and starts rAF immediately. If `Game` boots a fresh
beach and the snapshot lands later, you see a flash of the wrong world. Fix:
`main.ts` becomes async and awaits the load before constructing:

```ts
const store = new IndexedDbSnapshotStore()
const saved = await loadSnapshot(store, WIDTH, DEPTH)   // GameSnapshot | null, never throws
new Game(store, saved)
```

`Game` applies the snapshot **before** `new TerrainMesh(grid)` — `TerrainMesh`'s
constructor ends in `rebuildAll()` (`src/render/TerrainMesh.ts:44`), so the mesh
comes up correct first time with no extra rebuild.

**2. A save on `pagehide`/`freeze` is not guaranteed to commit.** IndexedDB writes
are async and the page may be frozen or discarded before the transaction lands.
Do not rely on them. The reliable trigger for *this* threat is
**`visibilitychange → hidden`**: Chrome only discards backgrounded tabs, and
`visibilitychange` fires at the instant of backgrounding — minutes before the
freeze. A throttled **periodic** save while visible then covers the cases
`visibilitychange` misses (crash, hard kill, GPU process loss). `pagehide` and
`freeze` are best-effort belt-and-braces on top. Getting this ordering right is
the difference between the feature working and only appearing to.

**3. Snapshot cost.** Copying 2 MiB at 30 Hz would be absurd. Save on a **5 s**
interval: the `.slice()` copies cost well under a millisecond and the write goes
off-thread, so it is noise against a 16 ms frame. Do *not* skip the save while
paused — tools stay live while paused by design (see PLAN.md), so state still
changes. A dirty-flag optimisation is possible but would thread a flag through
six classes to save a sub-millisecond copy; not worth it.

**4. Overlapping writes.** A 2 MiB IndexedDB write can outlast the 5 s interval on
a loaded machine. `AutoSaver` must skip a tick while a save is in flight rather
than queueing, or a stall turns into an unbounded backlog.

**5. A corrupt or half-written save must not brick the app.** `loadSnapshot`
catches everything and returns `null`; validation rejects rather than throws; a
`null` result means a fresh beach, silently.

**6. Losing `Waves.elapsed` and `Tide.elapsed` is what makes "exact" inexact.**
Both are `private elapsed = 0` and both feed a `sin()` phase. Drop them and the
sea teleports on resume — the most visible possible failure.

### Snapshot shape

```ts
// src/core/GameSnapshot.ts
export const SNAPSHOT_VERSION = 1

export interface GameSnapshot {
  version: number
  width: number
  depth: number
  grid:   { rock: Float32Array; sand: Float32Array; water: Float32Array
            moisture: Float32Array; source: Float32Array; sediment: Float32Array }
  water:  { flowX: Float32Array; flowZ: Float32Array }
  waves:  { elapsed: number; timeUntilWave: number }
  tide:   { elapsed: number }
  bucket: { amount: number }
  camera: { zoom: number; panX: number; panZ: number }
  toolMode: ToolMode
  paused: boolean
  lookEnabled: boolean
}

export function isValidSnapshot(value: unknown, width: number, depth: number): value is GameSnapshot
```

Deliberately **not** stored, with reasons:

- **The seven `Uint8Array(N)` dirty masks and `WaterSim.velocityArr`** — all
  scratch, `fill(0)` or recomputed at the top of each step.
- **All of `TerrainMesh`** (~3 MiB) — derived from `Grid`.
- **`SimClock.accumulator`** — a sub-step remainder, ≤ 1/30 s. Below perceptibility.
- **`rock`** *is* stored, even though it is never mutated by the sim (verified:
  `Erosion` and `Slope` write only `sand`; nothing writes `rock` after
  `initBeach`). Regenerating it instead would save 256 KiB of 2 MiB at the cost of
  coupling the save format to the noise constants in `Grid.ts`. Not worth it —
  noted here so the optimisation is not rediscovered as an oversight.

### Restore paths per class

`Grid` and `WaterSim` keep their arrays private and gain `snapshot()`/`restore()`
that copy (`.slice()` out, `.set()` in). Aliasing would let the sim mutate a
buffer mid-write.

`Bucket` needs **no new API** — `fill(amount)` on a fresh zero bucket sets exactly
`amount` (`src/core/Bucket.ts:21`). Don't add a setter that isn't needed.

`IsoCamera` needs one small refactor: `restore()` has to call `updateFrustum`,
which takes the canvas, and the class doesn't currently keep a reference to it.
Store the canvas in the constructor.

## Acceptance criteria

- [ ] Build a castle, discard the tab via `chrome://discards`, return — the beach,
      the castle, the water and the bucket are exactly as left
- [ ] The sea does not lurch or teleport on resume (tide and swell phase restored)
- [ ] A first-ever load, with no save present, starts a normal fresh beach
- [ ] A save written by an older `SNAPSHOT_VERSION`, or for different grid
      dimensions, is discarded and a fresh beach starts — no crash
- [ ] A deliberately corrupted record in DevTools → Application → IndexedDB
      produces a fresh beach, not a broken page
- [ ] Saving costs no visible hitch at 5 s intervals
- [ ] Full suite green, `npx tsc --noEmit` clean

## Steps

Each step is one RED-GREEN-REFACTOR cycle, committed on its own.

### Step 1: `Grid` round-trips its six arrays

**Test** (`src/core/grid.test.ts`): dig a cell and set a source, `snapshot()`,
mutate the grid further, `restore()` — the mutations are undone and the dug cell
is back. Separately: mutating the grid after `snapshot()` does **not** change the
snapshot (proves the copy).
**Implementation**: `Grid.snapshot(): GridSnapshot` using `.slice()`;
`Grid.restore(s)` using `.set()`.
**Done when**: grid tests green, nothing else touched.

### Step 2: `WaterSim` round-trips its flow field

**Test** (`src/sim/waterSim.test.ts`): set `flowX`/`flowZ` at a cell, snapshot,
`reset()`, restore, assert the flows return. Plus the same copy-not-alias test.
**Implementation**: `snapshot()`/`restore()` over `flowX`/`flowZ` only —
`velocityArr` and `dirty` are excluded deliberately.
**Done when**: waterSim tests green.

### Step 3: `Tide` round-trips its phase

**Test** (`src/sim/tide.test.ts`): step a tide to a non-trivial `offset`,
snapshot, restore into a fresh `Tide`, assert `offset` matches (`toBeCloseTo`).
**Implementation**: `snapshot(): { elapsed: number }` / `restore()`.
**Done when**: tide tests green.

### Step 4: `Waves` round-trips its phase and countdown

**Test** (`src/sim/waves.test.ts`): step, snapshot, restore into a fresh `Waves`,
assert `surfaceAt(x, z, seaSurface)` and `timeUntilWave` match.
**Implementation**: `snapshot()`/`restore()` over `elapsed` and `timeUntilWave`.
Note `timeUntilWave` is derivable from `elapsed`, but storing both is cheaper than
re-deriving the relation and keeps the two from drifting.
**Done when**: waves tests green.

### Step 5: `IsoCamera` round-trips zoom and pan

**Test** (new `src/render/isoCamera.test.ts`): `restore({zoom, panX, panZ})` then
`snapshot()` returns the same values. This works under jsdom despite
`clientWidth` being 0 — assert on the snapshot values, never on the camera
frustum, which is NaN there.
**Implementation**: keep the canvas as a field; `snapshot()`/`restore()`, with
`restore()` calling `updateFrustum` and `updateCameraPosition`.
**Done when**: the new test is green.

### Step 6: `isValidSnapshot` rejects anything it should not load

**Test** (new `src/core/gameSnapshot.test.ts`) — the heaviest test in the change.
A well-formed snapshot passes. Each of these fails: `null`; `undefined`; a
non-object; a wrong `version`; a mismatched `width`/`depth`; a missing nested
group; a `Float32Array` of the wrong length; a plain array where a
`Float32Array` is required; a `NaN` scalar.
**Implementation**: the pure type guard. It returns `false`; it never throws.
**Done when**: every rejection case is green.

### Step 7: a snapshot survives a structured-clone round trip intact

**Test** (`src/core/gameSnapshot.test.ts`): build a snapshot with distinctive
values in every array, `structuredClone` it, assert `isValidSnapshot` still
passes and every array is `toEqual` the original. Float32Array-to-Float32Array
comparison is exact, so `toEqual` is safe here — CLAUDE.md's warning is about
comparing against JS number *literals*, which this test must avoid.
**Implementation**: none expected; this is a characterisation test standing in
for the untestable IndexedDB path.
**Done when**: green, with a comment recording *why* it exists.

### Step 8: `AutoSaver` writes on schedule, and only one at a time

**Test** (new `src/core/autoSaver.test.ts`) against an inline fake `SnapshotStore`
whose `save` returns a promise the test resolves by hand:
no save before the interval elapses; one save once it does; the interval restarts
after a save; **a tick while a save is in flight is skipped, not queued**; a
rejected save does not prevent the next one; `saveNow()` saves immediately and
resets the interval.
**Implementation**: `new AutoSaver(store, intervalSeconds, () => GameSnapshot)`
with `tick(elapsedSeconds)` and `saveNow()`.
**Done when**: all six behaviours green. This is the step with the real content.

### Step 9: `loadSnapshot` turns a hostile store into `GameSnapshot | null`

**Test** (`src/core/gameSnapshot.test.ts`): a store returning a valid snapshot
yields it; one returning `null`, garbage, or a stale version yields `null`; a
store whose `load()` **rejects** yields `null` rather than propagating.
**Implementation**: `loadSnapshot(store, width, depth): Promise<GameSnapshot|null>`
— try/catch around `store.load()`, then `isValidSnapshot`.
**Done when**: green. This is the "a corrupt save must not brick the app"
guarantee, under test.

### Step 10: `IndexedDbSnapshotStore` — untested wiring

**Test**: none possible — `indexedDB` is `undefined` under jsdom (measured), and
the alternative is a `fake-indexeddb` devDependency that would only prove the
fake works. Covered by browser verification instead.
**Implementation**: open a `sandcastles` database with one `saves` object store,
`put`/`get` under a fixed key. Promise-wrap `IDBRequest`. Keep it to plumbing —
no validation, no scheduling; those are Steps 6–9 and already tested.
**Done when**: `tsc --noEmit` clean and a manual save/load visible in DevTools →
Application → IndexedDB.

### Step 11: `Game` restores from a snapshot and drives an `AutoSaver`

**Test**: none — `Game`'s constructor builds a WebGL `Renderer`, so it has no
harness. Behaviour-preserving where a snapshot is absent, and every piece it
composes is tested by Steps 1–9.
**Implementation**: `constructor(store: SnapshotStore, saved: GameSnapshot | null)`.
After building `Grid`/`Bucket`/sim objects but **before** `new TerrainMesh(grid)`,
apply `saved` if present: grid, waterSim, waves, tide, `bucket.fill(amount)`,
`toolMode`, `paused`, `lookEnabled`, then camera after `new IsoCamera(...)`.
Build a private `takeSnapshot(): GameSnapshot`. Add `autoSaver.tick(frameSeconds)`
to `loop`. `main.ts` becomes async per the trap above.
**Done when**: app runs unchanged with no save present; a save appears in
DevTools after ~5 s; a manual reload restores it.

### Step 12: lifecycle events trigger a save

**Test**: none. `document.visibilityState` is a read-only getter in jsdom, so a
test would have to `Object.defineProperty` it and dispatch a synthetic event —
that asserts the test's own scaffolding, not Chrome's behaviour, which is the
thing actually in question. Browser verification is the real check.
**Implementation**: in `Game`'s constructor, `visibilitychange` →
`if (document.visibilityState === 'hidden') autoSaver.saveNow()`, plus `pagehide`
and `freeze` as best-effort. Comment the ordering rationale from trap 2 — it is
non-obvious and someone will otherwise "simplify" the periodic save away.
**Done when**: verified in the browser per below.

## Verification

1. `npm test` and `npx tsc --noEmit` clean.
2. `npm run dev`, dig a distinctive castle, set a stream, note the bucket reading.
3. **DevTools → Application → IndexedDB → sandcastles** — confirm a record appears
   within ~5 s and its `version` and dimensions look right.
4. Switch to another tab, switch back — confirm a save fired on backgrounding.
5. Reload (⌘R). The castle, water, stream, bucket and camera come back; **watch
   the sea for a lurch** in the first second — that is the tide/swell phase check.
6. **Simulate the real failure**: open `chrome://discards`, find the sandcastles
   tab, click **Discard** in its row, then click back to the tab. It reloads — and
   must come back exactly as left. This is the acceptance test for the whole change.
7. **Corruption**: in DevTools, edit the stored record's `version` to `999`,
   reload — expect a clean fresh beach, no console error. Repeat with the record
   deleted, and with a field set to garbage.
8. Confirm no frame hitch every 5 s (Performance panel, or just watch the water).

## Notes

- Steps 10–12 are the only untested ones, each justified above; all three are
  wiring around logic that Steps 1–9 already cover.
- Follow the project's commit discipline: commit after each step with `npm test`
  and `tsc --noEmit` clean, and update `WIP.md` at each 🔴/🟢/⏸️ transition.
- `PLAN.md` and `WIP.md` currently hold the finished "D selects Dump" work, which
  is awaiting only a browser check. Confirm that check before overwriting them.
- Worth a follow-up, not in scope: the `Erosion.transportSediment` allocation
  churn (three `Float32Array(65536)` per step). Hoisting those to instance fields
  is a small change that would cut ~23 MB/s of garbage and make a discard less
  likely in the first place.
