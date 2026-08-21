# Plan: export and import the beach as a JSON file

## Context

The game already snapshots itself: `createSnapshot` (`src/core/GameSnapshot.ts`)
assembles a `GameSnapshot` from `Grid`, `WaterSim`, `Waves`, `Tide`, `Bucket` and
`IsoCamera`, `isValidSnapshot` guards it, and `IndexedDbSnapshotStore` persists it
across a Chrome tab discard. That is invisible machinery with no UI — the player
cannot get a beach *out* of the browser, hand it to someone, or keep two of them.

This plan adds an **Export** button that writes the current beach to a JSON file,
and an **Import** button that reads one back.

### Decisions taken up front

- **Cell layers are base64, not JSON numbers.** Measured on this grid: a dense
  layer as JSON numbers is 1.23 MB (`[1.0000000, 1.0004883, …]`, ~19 chars a
  float), a sparse one 0.32 MB — roughly 5 MB for the eight layers, and a
  several-hundred-millisecond `JSON.stringify` on the main thread. base64 of the
  raw bytes is a flat 0.35 MB a layer, **2.80 MB total**, and bit-exact. Rounding
  to 4 dp would give ~2 MB and readability, but sediment columns sit around 1e-6
  and the drying film at 1e-4 — both round away, and the export stops being a
  faithful snapshot. The file is JSON in shape; the payload is opaque.
- **Export is enabled only while the sim is paused.** A still world is a world
  the player can see is the one in the file.
- **Import is available whether paused or running**, but is confirmed before it
  replaces the beach: there is no undo, and the next autosave tick overwrites the
  IndexedDB save with the imported world.

## Design

### The file format

The file is the `GameSnapshot` shape with every `Float32Array` replaced by a
base64 string, plus an `encoding` tag and a `savedAt` stamp:

```json
{
  "version": 1,
  "encoding": "base64-f32le",
  "savedAt": "2026-08-21T17:40:00.000Z",
  "width": 256,
  "depth": 256,
  "grid":   { "rock": "AACAP…", "sand": "…", "water": "…",
              "moisture": "…", "source": "…", "sediment": "…" },
  "water":  { "flowX": "…", "flowZ": "…" },
  "waves":  { "elapsed": 1.5, "timeUntilWave": 0.5 },
  "tide":   { "elapsed": 12 },
  "bucket": { "amount": 250 },
  "camera": { "zoom": 80, "panX": 128, "panZ": 128 },
  "toolMode": "spade",
  "paused": true,
  "lookEnabled": false
}
```

**One `version` field, not two.** It is `SNAPSHOT_VERSION`, carried through
unchanged, so a file written by an older schema is rejected by the *existing*
check in `isValidSnapshot` rather than by a second parallel version rule. The
container's own concern — how the arrays are packed — is the separate `encoding`
tag, bumped if that ever changes.

`savedAt` is written and never read. It is there for a human looking at the file
and for the filename; the guard must not require it, so an ancient or
hand-edited file that lacks it still loads.

**`base64-f32le` assumes little-endian**, which is the raw byte order of a
`Float32Array` on every platform a browser runs on. The tag records the
assumption so a future reader is not left guessing. The endian-swapping branch is
deliberately *not* written: it could never be executed or tested here, and
untestable dead code is worse than a documented assumption.

### Parsing is guarded by the code that already guards a load

`parseGameFile` decodes the eight strings back into `Float32Array`s, assembles a
candidate object, and hands it to **`isValidSnapshot`**. Every rule about what a
valid beach is — version, dimensions, layer lengths, finite scalars, a known
`toolMode` — stays in one place, and an imported file is held to exactly the
standard a loaded save is.

The posture is the one `loadSnapshot` already takes: a file is hostile input, and
anything unreadable, stale or corrupt comes back as `null`. Malformed JSON, a
truncated base64 layer, a save from a 512×512 grid — all one answer, and the
answer never throws into the game loop.

### Import shares the boot restore path

`Game.restore` currently handles grid, water, waves, tide, bucket and the three
UI flags, while `isoCamera.restore(saved.camera)` is called separately further
down the constructor, because at that point in the constructor the camera does
not exist yet. Import needs the whole thing in one go, and having two restore
paths that must stay in step is exactly how a field gets restored on boot but not
on import.

So `Game.restore` becomes `applySnapshot(targets, snapshot)` in `GameSnapshot.ts`
— structurally typed like `SnapshotSources` and symmetric with `createSnapshot`,
including the camera. In the constructor the single call moves to just after
`IsoCamera` is built and before `new TerrainMesh(this.grid)`, which is
behaviour-preserving: nothing between the old and new call sites reads any of the
restored state.

That symmetry buys a real test — `createSnapshot → applySnapshot → createSnapshot`
over live components must come back identical. `Game` itself cannot be built
under jsdom (WebGL), so this round trip through real objects is what keeps the
feature honest, the same way `createSnapshot`'s test does today.

### `Bucket.fill` adds; restore needs to set

`Bucket.fill(n)` adds `n` up to capacity and returns what it took. `Game.restore`
calls `fill(saved.bucket.amount)` and gets the right answer *only because the
bucket is empty at boot*. Import restores into a bucket that may already hold
sand, where `fill` would add to it — a 250-sand bucket importing a 250-sand file
would land on 500, or clamp at capacity.

This is latent today and becomes a live bug the moment restore is reused. `Bucket`
gains `setAmount`, clamped to `[0, capacity]`, and `applySnapshot` uses it.

### Restoring mid-flight is safe, and lands paused

Import is available while the sim runs, but the apply never interleaves with a
sim step: the file read is async, so the callback lands between frames, and
`simStep` is synchronous. Nothing else needs guarding. `simClock`'s accumulator
holds at most 1/30 s and needs no reset, and the frame that spans the decode is
already clamped by `MAX_FRAME`.

Two consequences to expect rather than treat as defects:

- The imported world **arrives paused**, because export is only possible while
  paused, so `paused: true` is what every file carries and `applySnapshot`
  applies it faithfully. That is also the better landing: a still world to look
  at before resuming.
- `TerrainMesh` must `rebuildAll()`. The dirty-cell path cannot express "every
  cell changed", and the mesh is derived state that is deliberately not stored.

### Failure has to be visible

A rejected file must say so. `Toolbar.setReadouts` is rewritten by `updateHud` on
every frame, so the message needs its own element: `Toolbar` gains a status span
and `setStatus(text)`, which `updateHud` does not touch.

## Steps

Each step is a RED-GREEN-REFACTOR cycle, committed on its own once `npm test` and
`tsc --noEmit` are clean.

1. **`encodeCells` / `decodeCells`** — `src/core/base64Cells.ts`. Round-trips a
   `Float32Array` through base64 bit-exactly, including negatives and 1e-6
   magnitudes. Must chunk: `btoa(String.fromCharCode(...bytes))` overflows the
   call stack at 256 KiB, so a full 65536-cell layer is the test that matters.
   `decodeCells` returns `null` for a string that is not base64 or does not
   decode to the expected cell count.
2. **`Bucket.setAmount`** — sets rather than adds, clamped to `[0, capacity]`.
3. **`applySnapshot`** — extract from `Game.restore`, add the camera, use
   `setAmount`, and prove `createSnapshot → applySnapshot → createSnapshot` is
   identical over real components. Move the constructor's call site and drop the
   separate `isoCamera.restore`.
4. **`toGameFile`** — `src/core/GameFile.ts`. `GameSnapshot` → the file object:
   layers encoded, scalars verbatim, `encoding` and `savedAt` stamped.
5. **`parseGameFile`** — text → `GameSnapshot | null`, decoding then deferring to
   `isValidSnapshot`. Tests: a genuine `toGameFile → JSON.stringify →
   parseGameFile` round trip over real components, and `null` for malformed JSON,
   a wrong `version`, a wrong `encoding`, a missing layer, a truncated layer, and
   a mismatched grid size.
6. **`exportFilename(date)`** — `sandcastles-2026-08-21T17-40-00.json`. Colons are
   illegal in Windows filenames, so the ISO stamp is punctuated with dashes.
7. **Toolbar: Export and Import** — an Export button that `setPaused` enables and
   disables, an Import button that is always enabled, `onExport` / `onImport`
   handlers, and `setStatus`. Tests assert Export fires nothing while running and
   fires once when paused.
8. **Wire into `Game`** — Export: `createSnapshot` → `toGameFile` →
   `JSON.stringify` → download. Import: a hidden `<input type="file"
   accept="application/json">` → `file.text()` → `parseGameFile` → on `null`,
   `setStatus`; otherwise `confirm` → `applySnapshot` → `terrain.rebuildAll()` →
   reflect tool, pause and look state in the toolbar → `updateHud`.
   The Blob/object-URL download and the file input are plumbing only, in the
   spirit of `IndexedDbSnapshotStore`: every decision in the feature — what a
   valid file is, what the filename is, when the button is live — has been pulled
   out into a tested unit above.
9. **Verify in the browser** — export a beach mid-storm, reload with a cleared
   IndexedDB, import it back, and confirm the terrain, the tide phase and the
   camera all come back where they were.

## Out of scope

- **Multiple save slots or named saves.** The file *is* the slot.
- **Compression.** `CompressionStream('gzip')` would take 2.80 MB to a few
  hundred KB, but it makes the file no longer JSON, which is what was asked for.
- **Changing the IndexedDB autosave.** It keeps its own format; the two share
  `GameSnapshot`, `isValidSnapshot` and now `applySnapshot`, which is the whole
  of what they should share.
- **Migrating old files.** A file whose `version` is not current is rejected, not
  upgraded. There is exactly one version in the wild.
