# WIP: Export and import the beach as a JSON file

`PLAN.md` has the design. The game already snapshots itself into IndexedDB, but
a player cannot get a beach out of the browser. Adding an Export button (enabled
only while paused) that writes a JSON file, and an Import button that reads one
back.

Cell layers travel as base64 rather than JSON numbers: measured 2.80 MB against
~5 MB, and bit-exact where a 4 dp rounding would round away the sediment
columns (~1e-6) and the drying film (~1e-4).

## Current Step

None - work complete and verified.

## Status

✅ DONE - suite green (339), tsc clean, build clean, and confirmed in the
browser on 2026-08-23.

## Completed

- [x] Step 1: `encodeCells` / `decodeCells` round-trip a layer through base64
      bit-exactly. Chunked at 0x8000 bytes because `String.fromCharCode` takes
      its bytes as arguments and a 262,144-byte layer overflows the call stack.
      Decode treats its input as hostile: not-base64 and wrong-cell-count both
      give `null`. Encode honours a view's `byteOffset`/`byteLength`.
- [x] Step 2: `Bucket.setAmount` sets rather than adds, clamped to
      `[0, capacity]`. `fill` stays as it is — expressing it via `setAmount`
      would clamp `fill(-1)` at zero, which no test covers.
- [x] Step 3: `applySnapshot` puts a fresh game into the state a snapshot
      describes, camera included, so boot and import share one path. Verified
      by mutation that the round-trip test catches both a dropped camera and a
      bucket that adds instead of sets.
- [x] Step 4: `toGameFile` turns a snapshot into the file object. Takes the
      timestamp as an argument rather than reading the clock. `GridLayerFile`
      and `FlowLayerFile` are mapped types over the sim's own snapshot shapes,
      so a layer added to the sim is a compile error here rather than a layer
      quietly missing from every exported file — verified by adding one.
- [x] Step 5: `parseGameFile` reads a file back, decoding the layers and then
      deferring to `isValidSnapshot` rather than growing a second set of rules.
      The explicit null check on the decoded groups turned out to be dead - the
      guard already rejects a null group - so it went. Every remaining guard
      was mutation-checked against the test that holds it up.
- [x] Step 6: `exportFilename(date)` names the download. Dashes because a
      colon is illegal in a Windows filename; the ISO form otherwise, so a
      directory of exports sorts into the order it was saved.
- [x] Step 7: Toolbar gained Export (disabled unless paused), Import (never
      disabled, deliberately) and `setStatus`. The status is its own element
      because `updateHud` rewrites the readouts every frame. jsdom's `.click()`
      honours `disabled`, so the gate needs no second guard in the handler.
- [x] Step 8: `Game` wires both buttons. Export snapshots, builds the file and
      downloads it. Import opens a hidden file input, parses the chosen file,
      refuses it with a status message or confirms before replacing, then
      restores, rebuilds the terrain and puts the toolbar back in step.
      `reflectState` is shared with the boot restore. No unit test: `Game`
      cannot be built under jsdom.
- [x] Step 9: Verified in the browser. Export is refused while running and
      offered when paused; the downloaded file is 2,796,709 bytes - 2.80 MB, as
      predicted - with all eight layers exactly 65,536 cells and no NaN. The
      real file parses at 256x256 through the real `parseGameFile`, and
      re-exporting it is byte-identical. Import restored terrain and camera,
      refused a non-beach file without a dialog, honoured Cancel, worked twice
      running, and survived a reload.
